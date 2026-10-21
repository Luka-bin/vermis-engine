/* ============================================================================
   VERMIS // MODULE 03: WALKER LABYRINTH, G-BUFFER DDA RAYCASTER & CARTOGRAPHY
   File Address: vermis-engine/js/engine/raycaster.js
   Version: v1.5.2
   Implements: Walker-Method Map Generation, Anchor Safe Room, Rot Tiers 1-4,
               tile.consumed Pre-Invalidation, Live #cartography-canvas Sync,
               and update(dt) / render(time) Master Clock Wrappers
   ============================================================================ */

(function () {
  'use strict';

  var VERMIS = (window.VERMIS = window.VERMIS || {});

  var MAP_SIZE = 24;
  var W = 320;
  var H = 400;

  // Offscreen G-Buffer Canvas (Shared with Module 02 Lithography & Module 03/04 Billboards)
  var gCanvas = null;
  var gCtx = null;
  var gImgData = null;
  var gPixels = null;
  var mapInitialized = false;

  // 1D Perpendicular Depth Buffer for Billboard Z-Clipping
  var zBuffer = new Float32Array(W);

  // Labyrinth Grid Arrays
  // wallGrid: 0 = Empty Floor, 1 = Catacomb Masonry, 2 = Rust Archway Pillar, 3 = Anchor Shrine Wall
  var wallGrid = new Uint8Array(MAP_SIZE * MAP_SIZE);
  var rotGrid = new Uint8Array(MAP_SIZE * MAP_SIZE);
  var exploredGrid = new Uint8Array(MAP_SIZE * MAP_SIZE);
  var spatialTriggers = {};

  // Precomputed 8x8 Bayer matrix for built-in fallback presentation
  var RAW_BAYER = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ];
  var BAYER_8X8 = new Float32Array(64);
  for (var bIdx = 0; bIdx < 64; bIdx++) {
    BAYER_8X8[bIdx] = RAW_BAYER[bIdx] / 64.0 - 0.5;
  }

  function ensurePlayerObject() {
    VERMIS.State = VERMIS.State || {};
    if (!VERMIS.State.player) {
      VERMIS.State.player = {
        x: 3.5,
        y: 3.5,
        dirX: 1.0,
        dirY: 0.0,
        planeX: 0.0,
        planeY: 0.66,
        pitch: 0,
        bobPhase: 0,
        bobOffset: 0,
        moveSpeedBase: 2.55,
        rotSpeedBase: 2.15,
        hitboxRadius: 0.28,
        inputDirX: 0,
        inputDirY: 0
      };
    } else {
      var p = VERMIS.State.player;
      if (typeof p.x !== 'number') p.x = 3.5;
      if (typeof p.y !== 'number') p.y = 3.5;
      if (typeof p.dirX !== 'number') p.dirX = 1.0;
      if (typeof p.dirY !== 'number') p.dirY = 0.0;
      if (typeof p.planeX !== 'number') p.planeX = 0.0;
      if (typeof p.planeY !== 'number') p.planeY = 0.66;
      if (typeof p.pitch !== 'number') p.pitch = 0;
      if (typeof p.bobPhase !== 'number') p.bobPhase = 0;
      if (typeof p.bobOffset !== 'number') p.bobOffset = 0;
      if (typeof p.moveSpeedBase !== 'number') p.moveSpeedBase = 2.55;
      if (typeof p.rotSpeedBase !== 'number') p.rotSpeedBase = 2.15;
      if (typeof p.hitboxRadius !== 'number') p.hitboxRadius = 0.28;
    }
    return VERMIS.State.player;
  }

  function ensureBuffers() {
    if (gCanvas && gCtx && gImgData) return;
    gCanvas =
      document.getElementById('gbuffer-debug-canvas') ||
      document.createElement('canvas');
    gCanvas.width = W;
    gCanvas.height = H;
    gCtx = gCanvas.getContext('2d', { willReadFrequently: true });
    gImgData = gCtx.createImageData(W, H);
    gPixels = gImgData.data;
  }

  function markNeighborhoodExplored(px, py) {
    var cx = Math.floor(px);
    var cy = Math.floor(py);
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var tx = cx + dx;
        var ty = cy + dy;
        if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
          exploredGrid[ty * MAP_SIZE + tx] = 1;
        }
      }
    }
    if (VERMIS.State && VERMIS.State.exploredGrid && VERMIS.State.exploredGrid.length === exploredGrid.length) {
      VERMIS.State.exploredGrid.set(exploredGrid);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. WALKER-METHOD LABYRINTH GENERATOR WITH ANCHOR ROOM & ROT TIERS 1-4
  // ---------------------------------------------------------------------------
  function initLabyrinth() {
    ensureBuffers();
    var p = ensurePlayerObject();
    var rng =
      VERMIS.State && typeof VERMIS.State.rng === 'function'
        ? function () { return VERMIS.State.rng(); }
        : function () { return Math.random(); };

    wallGrid.fill(1);
    rotGrid.fill(1);
    exploredGrid.fill(0);
    spatialTriggers = {};

    // Carve 3x3 Anchor Room at (2..4, 2..4) - Safe Zone at start of floor
    var anchorX = 3;
    var anchorY = 3;
    for (var y = 2; y <= 4; y++) {
      for (var x = 2; x <= 4; x++) {
        wallGrid[y * MAP_SIZE + x] = 0;
        rotGrid[y * MAP_SIZE + x] = 0;
        exploredGrid[y * MAP_SIZE + x] = 1;
      }
    }
    wallGrid[1 * MAP_SIZE + 3] = 3;
    wallGrid[3 * MAP_SIZE + 1] = 3;

    // Guarantee open东/south exits from the Anchor Room so the player is never boxed in
    for (var ex = 5; ex <= 8; ex++) {
      wallGrid[3 * MAP_SIZE + ex] = 0;
    }
    for (var ey = 5; ey <= 8; ey++) {
      wallGrid[ey * MAP_SIZE + 3] = 0;
    }

    p.x = anchorX + 0.5;
    p.y = anchorY + 0.5;
    p.dirX = 1.0;
    p.dirY = 0.0;
    p.planeX = 0.0;
    p.planeY = 0.66;

    // Deterministic tunnel walker to carve corridors & chambers
    var wx = 6;
    var wy = 3;
    var dir = 0;
    var dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ];

    for (var step = 0; step < 220; step++) {
      if (rng() < 0.35) {
        dir = Math.floor(rng() * 4);
      }
      var nx = wx + dirs[dir][0];
      var ny = wy + dirs[dir][1];

      if (nx > 1 && nx < MAP_SIZE - 2 && ny > 1 && ny < MAP_SIZE - 2) {
        wx = nx;
        wy = ny;
        wallGrid[wy * MAP_SIZE + wx] = 0;

        if (rng() < 0.16) {
          wallGrid[wy * MAP_SIZE + (wx + 1)] = 0;
          if (wallGrid[(wy - 1) * MAP_SIZE + wx] === 1) {
            wallGrid[(wy - 1) * MAP_SIZE + wx] = 2;
          }
        }
      } else {
        dir = (dir + 1) % 4;
      }
    }

    // Compute radial Rot Tiers (1-4) and place consumable spatial triggers
    for (var ry = 0; ry < MAP_SIZE; ry++) {
      for (var rx = 0; rx < MAP_SIZE; rx++) {
        var idx = ry * MAP_SIZE + rx;
        if (rx >= 2 && rx <= 4 && ry >= 2 && ry <= 4) {
          rotGrid[idx] = 0;
          continue;
        }
        var dist = Math.abs(rx - anchorX) + Math.abs(ry - anchorY);
        if (dist <= 7) rotGrid[idx] = 1;
        else if (dist <= 14) rotGrid[idx] = 2;
        else if (dist <= 21) rotGrid[idx] = 3;
        else rotGrid[idx] = 4;

        if (wallGrid[idx] === 0 && dist === 5 && !spatialTriggers['shrine_draft']) {
          spatialTriggers[rx + ',' + ry] = {
            id: 'shrine_draft',
            consumed: false,
            message: 'CATACOMB DRAFT // COLD SPORE AIR SEEPS FROM THE OSSUARY ARCH.'
          };
        }
      }
    }

    if (VERMIS.State) {
      if (VERMIS.State.wallGrid && VERMIS.State.wallGrid.length === wallGrid.length) {
        VERMIS.State.wallGrid.set(wallGrid);
      }
      VERMIS.State.inAnchorRoom = true;
      VERMIS.State.rotTier = 1;
    }

    markNeighborhoodExplored(p.x, p.y);
    mapInitialized = true;
    renderCartographyMap();
  }

  // ---------------------------------------------------------------------------
  // 2. SPATIAL MOVEMENT, ROTATION & LIVE CARTOGRAPHY SYNC
  // ---------------------------------------------------------------------------
  function isWalkable(x, y, radius) {
    var rad = typeof radius === 'number' ? radius : 0.26;
    var minX = Math.floor(x - rad);
    var maxX = Math.floor(x + rad);
    var minY = Math.floor(y - rad);
    var maxY = Math.floor(y + rad);

    for (var ty = minY; ty <= maxY; ty++) {
      for (var tx = minX; tx <= maxX; tx++) {
        if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) return false;
        if (wallGrid[ty * MAP_SIZE + tx] !== 0) return false;
      }
    }
    return true;
  }

  function tryMovePlayer(dx, dy) {
    if (!mapInitialized) initLabyrinth();
    var p = ensurePlayerObject();
    var prevX = p.x;
    var prevY = p.y;

    if (isWalkable(p.x + dx, p.y, p.hitboxRadius)) {
      p.x += dx;
    }
    if (isWalkable(p.x, p.y + dy, p.hitboxRadius)) {
      p.y += dy;
    }

    if (p.x !== prevX || p.y !== prevY) {
      var tileX = Math.floor(p.x);
      var tileY = Math.floor(p.y);
      var tileIdx = tileY * MAP_SIZE + tileX;

      markNeighborhoodExplored(p.x, p.y);

      // Module 03.2: Pre-invalidate consumable spatial trigger before firing telemetry
      var trigKey = tileX + ',' + tileY;
      var trig = spatialTriggers[trigKey];
      if (trig && !trig.consumed) {
        trig.consumed = true;
        if (VERMIS.UI && typeof VERMIS.UI.logTelemetry === 'function') {
          VERMIS.UI.logTelemetry(trig.message);
        }
      }

      if (VERMIS.State) {
        var localRot = rotGrid[tileIdx] || 1;
        VERMIS.State.inAnchorRoom = localRot === 0;
        var mal = VERMIS.State.malignancy || 0;
        var malRot = mal >= 9 ? 4 : mal >= 6 ? 3 : mal >= 3 ? 2 : 1;
        VERMIS.State.rotTier = localRot === 0 ? 1 : Math.max(localRot, malRot);
      }

      // Live update of #cartography-canvas on position/tile change
      renderCartographyMap();
    }
  }

  function rotatePlayer(angle) {
    if (!mapInitialized) initLabyrinth();
    if (!angle) return;

    var p = ensurePlayerObject();
    var cosA = Math.cos(angle);
    var sinA = Math.sin(angle);

    var oldDirX = p.dirX;
    p.dirX = p.dirX * cosA - p.dirY * sinA;
    p.dirY = oldDirX * sinA + p.dirY * cosA;

    var oldPlaneX = p.planeX;
    p.planeX = p.planeX * cosA - p.planeY * sinA;
    p.planeY = oldPlaneX * sinA + p.planeY * cosA;

    // Live update of #cartography-canvas facing vector
    renderCartographyMap();
  }

  function updateSpatialMovement(dt) {
    if (!mapInitialized) initLabyrinth();
    if (VERMIS.State && VERMIS.State.mode === 'AUTO_PAUSE') return;

    var stepDt = typeof dt === 'number' && dt > 0 ? Math.min(0.1, dt) : 0.016;
    var inp = VERMIS.inputMap || {};
    var p = ensurePlayerObject();

    var agiStat =
      VERMIS.Character && typeof VERMIS.Character.getEffectiveStat === 'function'
        ? VERMIS.Character.getEffectiveStat('agility')
        : 4;
    var inAdr =
      VERMIS.Character && typeof VERMIS.Character.isInAdrenaline === 'function'
        ? VERMIS.Character.isInAdrenaline()
        : false;

    var agiMod = 0.85 + agiStat * 0.05;
    var adrBoost = inAdr ? 1.85 : 1.0;
    var moveStep = p.moveSpeedBase * agiMod * adrBoost * stepDt;
    var rotStep = p.rotSpeedBase * stepDt;

    var isAct = function (name) {
      if (typeof inp.isActionActive === 'function' && inp.isActionActive(name)) return true;
      if (inp.activeActions && typeof inp.activeActions.has === 'function' && inp.activeActions.has(name)) return true;
      return Boolean(inp[name]);
    };

    var moveX = 0;
    var moveY = 0;

    if (isAct('ACTION_MOVE_FORWARD') || p.inputDirY > 0) {
      moveX += p.dirX * moveStep;
      moveY += p.dirY * moveStep;
    }
    if (isAct('ACTION_MOVE_BACKWARD') || p.inputDirY < 0) {
      moveX -= p.dirX * moveStep * 0.82;
      moveY -= p.dirY * moveStep * 0.82;
    }
    if (isAct('ACTION_STRAFE_LEFT')) {
      moveX -= p.planeX * moveStep * 0.85;
      moveY -= p.planeY * moveStep * 0.85;
    }
    if (isAct('ACTION_STRAFE_RIGHT')) {
      moveX += p.planeX * moveStep * 0.85;
      moveY += p.planeY * moveStep * 0.85;
    }

    if (moveX !== 0 || moveY !== 0) {
      tryMovePlayer(moveX, moveY);
      p.bobPhase += stepDt * (inAdr ? 13.0 : 7.5);
      p.bobOffset = Math.sin(p.bobPhase) * 4.5;
    } else {
      p.bobOffset *= 0.85;
    }

    if (isAct('ACTION_TURN_LEFT') || p.inputDirX < 0) {
      rotatePlayer(-rotStep);
    }
    if (isAct('ACTION_TURN_RIGHT') || p.inputDirX > 0) {
      rotatePlayer(rotStep);
    }
    if (typeof inp.mouseDeltaX === 'number' && inp.mouseDeltaX !== 0) {
      rotatePlayer(inp.mouseDeltaX * 0.0035);
      inp.mouseDeltaX = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. VOLUMETRIC G-BUFFER DDA RAYCASTER (Alpha = 64 Environment Tagging)
  // ---------------------------------------------------------------------------
  function sampleProceduralMasonry(u, v, wallType, rotTier) {
    var tx = u & 63;
    var ty = v & 63;

    var row = ty >> 3;
    var brickX = (tx + (row & 1) * 16) & 31;
    var brickY = ty & 7;
    var isMortar = brickX < 2 || brickY < 1;

    var grain = ((Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453) % 1 + 1) % 1;

    var isArchRecess = false;
    if (wallType === 2) {
      var dx = tx - 32;
      var dy = ty - 28;
      if ((ty >= 28 && Math.abs(dx) < 18) || dx * dx + dy * dy < 324) {
        isArchRecess = true;
      }
    }

    var lum = isMortar ? 0.18 : 0.62 + (grain - 0.5) * 0.32;
    var matID = 115;

    if (isArchRecess) {
      lum = 0.74 + (grain - 0.5) * 0.25;
      matID = 215;
    } else if (wallType === 3) {
      lum = isMortar ? 0.25 : 0.80 + (grain - 0.5) * 0.2;
      matID = 140;
    } else if (rotTier >= 3) {
      if (grain > 0.45 || ty > 44) {
        matID = 65;
        lum *= 0.82;
      }
    }

    return { lum: lum, matID: matID, isMortar: isMortar };
  }

  function renderDungeonGBuffer(time) {
    if (!mapInitialized) initLabyrinth();
    ensureBuffers();

    var t = typeof time === 'number' ? time : performance.now() * 0.001;
    var p = ensurePlayerObject();
    var rotTier = (VERMIS.State && VERMIS.State.rotTier) || 1;
    var maxSightDist = rotTier === 4 ? 5.8 : rotTier === 3 ? 8.0 : 11.5;
    var horizon = Math.floor(H * 0.5 + (p.pitch || 0) + (p.bobOffset || 0));

    // 1. Floor & Ceiling Scanline Casting into G-Buffer (Alpha = 64 tags 3D environment)
    for (var y = 0; y < H; y++) {
      var isFloor = y >= horizon;
      var pDist = isFloor ? y - horizon : horizon - y;
      var rowDist = pDist === 0 ? 999 : (0.5 * H) / pDist;
      var fogFactor = Math.max(0, 1.0 - rowDist / maxSightDist);

      var stepX = (rowDist * 2 * p.planeX) / W;
      var stepY = (rowDist * 2 * p.planeY) / W;

      var worldX = p.x + rowDist * (p.dirX - p.planeX);
      var worldY = p.y + rowDist * (p.dirY - p.planeY);

      for (var x = 0; x < W; x++) {
        var idx4 = (y * W + x) << 2;
        var cellX = ((worldX * 32) & 31) ^ ((worldY * 32) & 31);
        var ripple =
          isFloor && rotTier >= 2 ? Math.sin(worldX * 6.0 + t * 2.2) * 0.08 : 0;

        var baseFloorLum = isFloor
          ? (0.30 + (cellX & 7) * 0.025 + ripple) * fogFactor
          : (0.18 + (cellX & 3) * 0.02) * fogFactor;

        gPixels[idx4] = Math.min(255, Math.max(0, Math.round(baseFloorLum * 255)));
        gPixels[idx4 + 1] = isFloor && rotTier >= 2 ? 70 : 95;
        gPixels[idx4 + 2] = Math.min(255, Math.round(fogFactor * 120));
        gPixels[idx4 + 3] = 64;

        worldX += stepX;
        worldY += stepY;
      }
    }

    // 2. Vertical Wall Strip DDA Raycasting
    for (var col = 0; col < W; col++) {
      var cameraX = (2 * col) / W - 1;
      var rayDirX = p.dirX + p.planeX * cameraX;
      var rayDirY = p.dirY + p.planeY * cameraX;

      var mapX = Math.floor(p.x);
      var mapY = Math.floor(p.y);

      var deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      var deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

      var stepGridX, sideDistX;
      var stepGridY, sideDistY;

      if (rayDirX < 0) {
        stepGridX = -1;
        sideDistX = (p.x - mapX) * deltaDistX;
      } else {
        stepGridX = 1;
        sideDistX = (mapX + 1.0 - p.x) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepGridY = -1;
        sideDistY = (p.y - mapY) * deltaDistY;
      } else {
        stepGridY = 1;
        sideDistY = (mapY + 1.0 - p.y) * deltaDistY;
      }

      var hit = 0;
      var side = 0;
      var wallType = 1;

      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepGridX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepGridY;
          side = 1;
        }

        if (mapX < 0 || mapX >= MAP_SIZE || mapY < 0 || mapY >= MAP_SIZE) {
          hit = 1;
          wallType = 1;
        } else if (wallGrid[mapY * MAP_SIZE + mapX] > 0) {
          hit = 1;
          wallType = wallGrid[mapY * MAP_SIZE + mapX];
        }
      }

      var perpWallDist =
        side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      zBuffer[col] = Math.max(0.05, perpWallDist);

      var lineHeight = Math.floor(H / zBuffer[col]);
      var drawStart = Math.max(0, Math.floor(-lineHeight / 2 + horizon));
      var drawEnd = Math.min(H - 1, Math.floor(lineHeight / 2 + horizon));

      var wallX =
        side === 0 ? p.y + perpWallDist * rayDirY : p.x + perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);
      var texX = Math.floor(wallX * 64) & 63;

      var distAtten = Math.max(0, 1.0 - perpWallDist / maxSightDist);
      var sideShade = side === 1 ? 0.72 : 1.0;

      var stepTex = 64.0 / Math.max(1, lineHeight);
      var texPos = (drawStart - horizon + lineHeight / 2) * stepTex;

      for (var wy = drawStart; wy <= drawEnd; wy++) {
        var texY = Math.floor(texPos) & 63;
        texPos += stepTex;

        var sample = sampleProceduralMasonry(texX, texY, wallType, rotTier);
        var finalLum = sample.lum * distAtten * sideShade;

        var wIdx4 = (wy * W + col) << 2;
        gPixels[wIdx4] = Math.min(255, Math.max(0, Math.round(finalLum * 255)));
        gPixels[wIdx4 + 1] = sample.matID;
        gPixels[wIdx4 + 2] = sample.isMortar ? 35 : Math.round(distAtten * 210);
        gPixels[wIdx4 + 3] = 64;
      }
    }

    gCtx.putImageData(gImgData, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // 4. STAGE BAYER LITHOGRAPHY PASS & LIVE CARTOGRAPHY RENDERER
  // ---------------------------------------------------------------------------
  function presentFallbackLitho() {
    var stageCanvas =
      document.getElementById('visual-stage-canvas') ||
      document.getElementById('displayCanvas');
    if (!stageCanvas || !gCtx) return;

    if (stageCanvas.width !== W) stageCanvas.width = W;
    if (stageCanvas.height !== H) stageCanvas.height = H;

    var sCtx = stageCanvas.getContext('2d');
    var src = gCtx.getImageData(0, 0, W, H).data;
    var out = sCtx.createImageData(W, H);
    var out32 = new Uint32Array(out.data.buffer);

    var INK_BLACK = (255 << 24) | (8 << 16) | (11 << 8) | 10;
    var DEEP_MOSS = (255 << 24) | (23 << 16) | (42 << 8) | 24;
    var MID_MOSS = (255 << 24) | (41 << 16) | (83 << 8) | 52;
    var BONE_LIGHT = (255 << 24) | (128 << 16) | (168 << 8) | 178;
    var MID_RUST = (255 << 24) | (28 << 16) | (56 << 8) | 168;
    var BRIGHT_RUST = (255 << 24) | (45 << 16) | (96 << 8) | 214;

    for (var y = 0; y < H; y++) {
      var bRow = (y & 7) << 3;
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        var idx4 = i << 2;
        var bayer = BAYER_8X8[bRow | (x & 7)] * 0.42;
        var v = src[idx4] / 255.0 + bayer;
        var mat = src[idx4 + 1];

        if (mat > 180) {
          out32[i] = v < 0.28 ? INK_BLACK : v < 0.62 ? MID_RUST : BRIGHT_RUST;
        } else {
          out32[i] =
            v < 0.20
              ? INK_BLACK
              : v < 0.46
              ? DEEP_MOSS
              : v < 0.74
              ? MID_MOSS
              : BONE_LIGHT;
        }
      }
    }
    sCtx.putImageData(out, 0, 0);
  }

  function renderCartographyMap() {
    var canvas = document.getElementById('cartography-canvas');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var cw = canvas.width || 240;
    var ch = canvas.height || 240;
    var cellW = cw / MAP_SIZE;
    var cellH = ch / MAP_SIZE;

    ctx.fillStyle = '#070806';
    ctx.fillRect(0, 0, cw, ch);

    for (var y = 0; y < MAP_SIZE; y++) {
      for (var x = 0; x < MAP_SIZE; x++) {
        var idx = y * MAP_SIZE + x;
        if (exploredGrid[idx] === 0) continue;

        if (wallGrid[idx] === 3) {
          ctx.fillStyle = '#8f391e';
        } else if (wallGrid[idx] > 0) {
          ctx.fillStyle = '#26331e';
        } else if (rotGrid[idx] === 0) {
          ctx.fillStyle = '#1d2b19';
        } else {
          ctx.fillStyle = '#12170f';
        }

        ctx.fillRect(
          Math.floor(x * cellW),
          Math.floor(y * cellH),
          Math.ceil(cellW - 1),
          Math.ceil(cellH - 1)
        );
      }
    }

    var p = ensurePlayerObject();
    var px = p.x * cellW;
    var py = p.y * cellH;

    // Facing vector line
    ctx.strokeStyle = '#ff003c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + p.dirX * (cellW * 1.4), py + p.dirY * (cellH * 1.4));
    ctx.stroke();

    // Player marker dot
    ctx.fillStyle = '#c8bf9e';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.5, cellW * 0.38), 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Master Clock Render Wrapper:
   * Calls renderDungeonGBuffer(time) followed by presentFallbackLitho()
   */
  function render(time) {
    renderDungeonGBuffer(time);
    presentFallbackLitho();
  }

  window.addEventListener('VermisModalOpened', function (e) {
    if (e && e.detail && e.detail.modalId === 'modal-map') {
      renderCartographyMap();
    }
  });

  VERMIS.Raycaster = {
    initLabyrinth: initLabyrinth,
    initMap: initLabyrinth,
    updateSpatialMovement: updateSpatialMovement,
    update: updateSpatialMovement,
    tryMovePlayer: tryMovePlayer,
    rotatePlayer: rotatePlayer,
    renderDungeonGBuffer: renderDungeonGBuffer,
    presentFallbackLitho: presentFallbackLitho,
    render: render,
    renderCartographyMap: renderCartographyMap,
    renderMap: renderCartographyMap,
    isWalkable: isWalkable,
    getPlayerCamera: ensurePlayerObject,
    getGBufferCanvas: function () {
      ensureBuffers();
      return gCanvas;
    },
    getGBufferContext: function () {
      ensureBuffers();
      return gCtx;
    },
    getZBuffer: function () {
      return zBuffer;
    },
    getWallGrid: function () {
      return wallGrid;
    },
    getRotGrid: function () {
      return rotGrid;
    },
    getExploredGrid: function () {
      return exploredGrid;
    },
    MAP_SIZE: MAP_SIZE
  };
})();

