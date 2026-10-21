/* ============================================================================
   VERMIS // MODULE 03: 3D BILLBOARD PROJECTOR, 1.5s TELEGRAPH AI & WEAPON ARC
   File Address: vermis-engine/js/engine/billboard.js
   Version: v1.4.1
   Implements: Z-Clipped 3D Sprite Projection into Shared G-Buffer (Alpha 255),
               4-Stage Telegraph State Machine (1.5s Backpedal Window),
               Daggerfall First-Person Weapon Swing, & Spectral Entity Encoding
   ============================================================================ */

(function () {
  'use strict';

  const V = (window.VERMIS = window.VERMIS || {});
  V.Bestiary = V.Bestiary || {};

  const W = 320;
  const H = 400;
  const SPRITE_SIZE = 128;

  // Offscreen Sprite G-Buffer for rendering individual enemies before 3D Z-clipping
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = SPRITE_SIZE;
  spriteCanvas.height = SPRITE_SIZE;
  const spriteCtx = spriteCanvas.getContext('2d', { willReadFrequently: true });

  const entities = [];
  let weaponSwingProgress = 0; // 0 = idle, 0..1 = active slash arc
  let initializedEntities = false;

  function logBillboard(msg, isAlert = false) {
    if (V.UI && typeof V.UI.logTelemetry === 'function') {
      V.UI.logTelemetry(msg, isAlert);
    } else if (V.UI && typeof V.UI.log === 'function') {
      V.UI.log(msg, isAlert);
    } else if (typeof V.logTelemetry === 'function') {
      V.logTelemetry(msg, isAlert);
    }
  }

  function getCameraState() {
    if (V.Raycaster && typeof V.Raycaster.getPlayerCamera === 'function') {
      return V.Raycaster.getPlayerCamera();
    }
    if (V.State && V.State.player) {
      return V.State.player;
    }
    return {
      x: 3.5,
      y: 3.5,
      dirX: 1.0,
      dirY: 0.0,
      planeX: 0.0,
      planeY: 0.66,
      pitch: 0,
      bobOffset: 0
    };
  }

  // ---------------------------------------------------------------------------
  // 1. ENEMY ENTITY CLASS & 4-STAGE TELEGRAPH STATE MACHINE (1.5s WINDOW)
  // ---------------------------------------------------------------------------
  class LabyrinthEntity {
    constructor(cfg) {
      this.id = cfg.id;
      this.name = cfg.name || 'The Stench Champion';
      this.type = cfg.type || 'STENCH_CHAMPION';
      this.x = cfg.x;
      this.y = cfg.y;
      this.patrolOriginX = cfg.x;
      this.patrolOriginY = cfg.y;
      this.patrolAngle = 0;

      // Diceless Combat Target Number (TN) & Endurance
      this.baseTN = cfg.baseTN || 10;
      this.integrity = cfg.integrity || 3;
      this.inflictsComplication = cfg.inflictsComplication || 'SHATTERED_RIBS';
      this.spectralHidden = Boolean(cfg.spectralHidden); // Encoded at G=242 until revealed by Loupe

      // 4-Stage Telegraph AI State Machine:
      // 'DORMANT' -> 'AGGRO' -> 'TELEGRAPH' (1.5s) -> 'IMPACT' -> 'SLAIN'
      this.aiState = 'DORMANT';
      this.telegraphTimer = 0;
      this.telegraphDuration = 1.5; // Mandatory 1.5-second backpedal window
      this.moveSpeed = cfg.moveSpeed || 1.15;
      this.aggroRange = cfg.aggroRange || 5.5;
      this.strikeRange = cfg.strikeRange || 1.18;
    }

    updateAI(time, dt) {
      if (this.aiState === 'SLAIN') return;

      // Enemies cannot enter the starting Anchor Safe Room
      if (V.State && V.State.inAnchorRoom) {
        this.aiState = 'DORMANT';
        this.telegraphTimer = 0;
        return;
      }

      const cam = getCameraState();
      const dx = cam.x - this.x;
      const dy = cam.y - this.y;
      const dist = Math.hypot(dx, dy);
      const canWalk = (nx, ny) =>
        !V.Raycaster ||
        typeof V.Raycaster.isWalkable !== 'function' ||
        V.Raycaster.isWalkable(nx, ny, 0.24);

      switch (this.aiState) {
        case 'DORMANT': {
          this.patrolAngle += dt * 0.8;
          const tx = this.patrolOriginX + Math.cos(this.patrolAngle) * 0.35;
          const ty = this.patrolOriginY + Math.sin(this.patrolAngle) * 0.35;
          if (canWalk(tx, ty)) {
            this.x = tx;
            this.y = ty;
          }
          if (dist <= this.aggroRange && !this.spectralHidden) {
            this.aiState = 'AGGRO';
            logBillboard(
              `PROXIMITY ALERT // <u class="mech-term">${this.name.toUpperCase()}</u> DETECTS YOUR PRESENCE!`
            );
          }
          break;
        }

        case 'AGGRO': {
          if (dist <= this.strikeRange) {
            this.aiState = 'TELEGRAPH';
            this.telegraphTimer = this.telegraphDuration;
            logBillboard(
              `TELEGRAPH [1.5s] // <u class="mech-term">${this.name.toUpperCase()}</u> RAISES ITS CLEAVER! BACKPEDAL NOW!`,
              true
            );
          } else if (dist > this.aggroRange * 1.65) {
            this.aiState = 'DORMANT';
          } else {
            const step = this.moveSpeed * dt;
            const nx = this.x + (dx / Math.max(0.01, dist)) * step;
            const ny = this.y + (dy / Math.max(0.01, dist)) * step;
            if (canWalk(nx, this.y)) this.x = nx;
            if (canWalk(this.x, ny)) this.y = ny;
          }
          break;
        }

        case 'TELEGRAPH': {
          this.telegraphTimer -= dt;
          // If player physically backpedals out of strike hitbox within 1.5s, no stat check fires!
          if (dist > this.strikeRange * 1.38) {
            this.aiState = 'AGGRO';
            this.telegraphTimer = 0;
            logBillboard(
              `SPACING MAINTAINED // YOU EVADED ${this.name.toUpperCase()}'S STRIKE ARC.`
            );
          } else if (this.telegraphTimer <= 0) {
            this.aiState = 'IMPACT';
            if (V.Combat && typeof V.Combat.triggerAutoPauseInterrupt === 'function') {
              V.Combat.triggerAutoPauseInterrupt(this);
            } else if (V.State && typeof V.State.triggerAutoPause === 'function') {
              V.State.triggerAutoPause(this);
            }
          }
          break;
        }

        case 'IMPACT': {
          if (!V.State || V.State.mode === 'SPATIAL_HUNT') {
            this.aiState = 'AGGRO';
          }
          break;
        }
      }
    }

    pushBack(distance) {
      const cam = getCameraState();
      const dx = this.x - cam.x;
      const dy = this.y - cam.y;
      const len = Math.max(0.01, Math.hypot(dx, dy));
      const nx = this.x + (dx / len) * distance;
      const ny = this.y + (dy / len) * distance;
      if (
        !V.Raycaster ||
        typeof V.Raycaster.isWalkable !== 'function' ||
        V.Raycaster.isWalkable(nx, ny, 0.22)
      ) {
        this.x = nx;
        this.y = ny;
      }
      this.resetTelegraph();
    }

    resetTelegraph() {
      this.aiState = 'AGGRO';
      this.telegraphTimer = 0;
    }

    takeDeterministicStrike(dmg = 1) {
      this.integrity -= dmg;
      if (this.integrity <= 0) {
        this.aiState = 'SLAIN';
        logBillboard(
          `TARGET VANQUISHED // <u class="mech-term">${this.name.toUpperCase()}</u> COLLAPSES INTO ROTTING BONE.`
        );
      } else {
        this.pushBack(0.75);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. SPAWN ENTITIES IN CARVED LABYRINTH CORRIDORS
  // ---------------------------------------------------------------------------
  function spawnFloorEntities() {
    entities.length = 0;
    initializedEntities = true;

    if (
      V.Raycaster &&
      typeof V.Raycaster.getWallGrid === 'function' &&
      typeof V.Raycaster.getRotGrid === 'function'
    ) {
      const grid = V.Raycaster.getWallGrid();
      const rotGrid = V.Raycaster.getRotGrid();
      const size = V.Raycaster.MAP_SIZE || 24;
      const candidates = [];

      for (let y = 2; y < size - 2; y++) {
        for (let x = 2; x < size - 2; x++) {
          const idx = y * size + x;
          if (grid[idx] === 0 && rotGrid[idx] >= 1) {
            candidates.push({ x: x + 0.5, y: y + 0.5, rot: rotGrid[idx] });
          }
        }
      }

      if (candidates.length > 0) {
        const first = candidates[Math.min(4, candidates.length - 1)];
        entities.push(
          new LabyrinthEntity({
            id: 'enemy_stench_01',
            name: 'The Stench Champion',
            type: 'STENCH_CHAMPION',
            x: first.x,
            y: first.y,
            baseTN: 10,
            integrity: 3,
            inflictsComplication: 'SHATTERED_RIBS'
          })
        );
      }

      if (candidates.length > 14) {
        const mid = candidates[Math.floor(candidates.length * 0.5)];
        entities.push(
          new LabyrinthEntity({
            id: 'enemy_gobbler_02',
            name: 'Light Gobbler',
            type: 'LIGHT_GOBBLER',
            x: mid.x,
            y: mid.y,
            baseTN: 9,
            integrity: 2,
            inflictsComplication: 'BLINDNESS',
            spectralHidden: true // Encoded at G=242 for Module 02 Spectral Loupe Reveal
          })
        );
      }
    } else {
      // Fallback coordinates if Raycaster grid is not yet initialized
      entities.push(
        new LabyrinthEntity({
          id: 'enemy_stench_01',
          name: 'The Stench Champion',
          type: 'STENCH_CHAMPION',
          x: 6.5,
          y: 3.5,
          baseTN: 10,
          integrity: 3,
          inflictsComplication: 'SHATTERED_RIBS'
        })
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PROCEDURAL ETHEREAL SKETCH BILLBOARD DRAW (With Module 04 Rig Hook)
  // ---------------------------------------------------------------------------
  function renderEntityToSpriteBuffer(entity, time) {
    spriteCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

    // Hook into Module 04 Bestiary procedural rig if registered
    const rigModule =
      V.Bestiary[entity.type] ||
      (entity.type === 'STENCH_CHAMPION' ? V.Bestiary.StenchChampion : null);

    if (rigModule && typeof rigModule.renderRig === 'function') {
      rigModule.renderRig(spriteCtx, entity, time);
      return;
    }

    // Built-in High-Contrast Ethereal Sketch Billboard Fallback
    const isTelegraph = entity.aiState === 'TELEGRAPH';
    const flash = isTelegraph && Math.sin(time * 28.0) > 0;
    // Material ID: 242 = Spectral Entity (only visible in Loupe), 230 = Crimson Telegraph, 140 = Bone
    const matID = entity.spectralHidden ? 242 : isTelegraph ? 230 : 140;
    const jitterX = entity.aiState !== 'DORMANT' ? Math.sin(time * 37.0) * 2.2 : 0;
    const breathY = Math.sin(time * 2.2) * 2.5;

    spriteCtx.save();
    spriteCtx.translate(64 + jitterX, 68 + breathY);

    // Necrotic core shadow mass
    spriteCtx.fillStyle = `rgb(22, ${entity.spectralHidden ? 242 : 55}, 40)`;
    spriteCtx.beginPath();
    spriteCtx.ellipse(0, 4, 24, 36, 0, 0, Math.PI * 2);
    spriteCtx.fill();

    // Twin Centipede Spinal Arch Horns
    spriteCtx.strokeStyle = `rgb(${flash ? 250 : 195}, ${matID}, 190)`;
    spriteCtx.lineWidth = 3.2;
    for (const dir of [-1, 1]) {
      spriteCtx.beginPath();
      spriteCtx.moveTo(dir * 8, -22);
      spriteCtx.quadraticCurveTo(dir * 34, -48, dir * 18, -56);
      spriteCtx.stroke();
    }

    // Thoracic Ribcage & Fused Skulls
    spriteCtx.fillStyle = `rgb(${flash ? 255 : 215}, ${matID}, 210)`;
    spriteCtx.beginPath();
    spriteCtx.arc(-3, -24, 11, 0, Math.PI * 2);
    spriteCtx.arc(14, -18, 8, 0, Math.PI * 2);
    spriteCtx.fill();

    spriteCtx.lineWidth = 2.4;
    for (let r = -10; r <= 16; r += 6) {
      spriteCtx.beginPath();
      spriteCtx.moveTo(-18, r);
      spriteCtx.quadraticCurveTo(0, r + 4, 18, r);
      spriteCtx.stroke();
    }

    // Raised Weapon / Extended Claw Telegraph
    const armLift = isTelegraph ? -26 : 0;
    spriteCtx.lineWidth = 3.5;
    spriteCtx.beginPath();
    spriteCtx.moveTo(16, -12);
    spriteCtx.lineTo(36, 12 + armLift);
    spriteCtx.lineTo(32, 38 + armLift);
    spriteCtx.stroke();

    // Legs
    spriteCtx.beginPath();
    spriteCtx.moveTo(-10, 22);
    spriteCtx.lineTo(-14, 52);
    spriteCtx.moveTo(10, 22);
    spriteCtx.lineTo(14, 52);
    spriteCtx.stroke();

    spriteCtx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. 3D CAMERA PROJECTION & Z-BUFFER CLIPPING INTO SHARED G-BUFFER
  // ---------------------------------------------------------------------------
  function projectSpritesIntoGBuffer(time) {
    if (!V.Raycaster || typeof V.Raycaster.getGBufferContext !== 'function') return;
    const gCtx = V.Raycaster.getGBufferContext();
    const zBuffer = V.Raycaster.getZBuffer ? V.Raycaster.getZBuffer() : null;
    if (!gCtx || !zBuffer) return;

    if (!initializedEntities) {
      spawnFloorEntities();
    }

    const cam = getCameraState();
    const gImg = gCtx.getImageData(0, 0, W, H);
    const gData = gImg.data;

    const sorted = entities
      .filter((e) => e.aiState !== 'SLAIN')
      .map((e) => ({
        entity: e,
        distSq: (cam.x - e.x) ** 2 + (cam.y - e.y) ** 2
      }))
      .sort((a, b) => b.distSq - a.distSq);

    for (const item of sorted) {
      const ent = item.entity;
      const spriteX = ent.x - cam.x;
      const spriteY = ent.y - cam.y;

      const det = cam.planeX * cam.dirY - cam.dirX * cam.planeY;
      if (Math.abs(det) < 1e-5) continue;
      const invDet = 1.0 / det;

      const transformX = invDet * (cam.dirY * spriteX - cam.dirX * spriteY);
      const transformY = invDet * (-cam.planeY * spriteX + cam.planeX * spriteY);

      if (transformY <= 0.15) continue;

      const spriteScreenX = Math.floor((W / 2) * (1 + transformX / transformY));
      const spriteHeight = Math.abs(Math.floor(H / transformY));
      const spriteWidth = spriteHeight;

      const horizon = Math.floor(H * 0.5 + (cam.pitch || 0) + (cam.bobOffset || 0));
      const drawStartY = Math.max(0, Math.floor(-spriteHeight / 2 + horizon));
      const drawEndY = Math.min(H - 1, Math.floor(spriteHeight / 2 + horizon));
      const drawStartX = Math.max(0, Math.floor(-spriteWidth / 2 + spriteScreenX));
      const drawEndX = Math.min(W - 1, Math.floor(spriteWidth / 2 + spriteScreenX));

      renderEntityToSpriteBuffer(ent, time);
      const sData = spriteCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
      const distAtten = Math.max(0.15, Math.min(1.0, 1.0 - transformY / 10.5));

      for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
        if (transformY >= zBuffer[stripe]) continue;

        const texX = Math.floor(
          ((stripe - (-spriteWidth / 2 + spriteScreenX)) * SPRITE_SIZE) / spriteWidth
        );
        if (texX < 0 || texX >= SPRITE_SIZE) continue;

        for (let y = drawStartY; y < drawEndY; y++) {
          const d = y - horizon + spriteHeight / 2;
          const texY = Math.floor((d * SPRITE_SIZE) / spriteHeight);
          if (texY < 0 || texY >= SPRITE_SIZE) continue;

          const sIdx = (texY * SPRITE_SIZE + texX) << 2;
          if (sData[sIdx + 3] > 80) {
            const gIdx = (y * W + stripe) << 2;
            gData[gIdx] = Math.round(sData[sIdx] * distAtten);
            gData[gIdx + 1] = sData[sIdx + 1];
            gData[gIdx + 2] = sData[sIdx + 2];
            // Alpha 255 tags pixel as foreground creature for Module 02 Lithography Shader
            // Spectral hidden entities keep alpha 32 so normal pass hides them while Loupe X-Ray (G>=240) reveals them
            gData[gIdx + 3] = ent.spectralHidden ? 32 : 255;
          }
        }
      }
    }

    gCtx.putImageData(gImg, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // 5. DAGGERFALL FIRST-PERSON WEAPON SWING & DETERMINISTIC HIT CHECK
  // ---------------------------------------------------------------------------
  function updateAndRenderWeapon(time, dt) {
    const inp = V.inputMap || {};
    const metrics =
      V.Combat && typeof V.Combat.getWeaponMetrics === 'function'
        ? V.Combat.getWeaponMetrics()
        : { swingDuration: 0.48, heavySolaceCost: 1 };

    const attackPressed =
      Boolean(inp.ACTION_ATTACK) ||
      (typeof inp.isActionActive === 'function' && inp.isActionActive('ACTION_ATTACK'));

    if (attackPressed && weaponSwingProgress === 0) {
      weaponSwingProgress = 0.001;
      inp.ACTION_ATTACK = false;
    }

    if (weaponSwingProgress > 0 && dt > 0) {
      const prev = weaponSwingProgress;
      weaponSwingProgress += dt / metrics.swingDuration;

      if (prev < 0.5 && weaponSwingProgress >= 0.5) {
        checkPlayerMeleeHit();
      }
      if (weaponSwingProgress >= 1.0) {
        weaponSwingProgress = 0;
      }
    }

    if (!V.Raycaster || typeof V.Raycaster.getGBufferContext !== 'function') return;
    const gCtx = V.Raycaster.getGBufferContext();
    if (!gCtx) return;

    const cam = getCameraState();
    const bob = cam.bobOffset || 0;
    const swingArc = weaponSwingProgress > 0 ? Math.sin(weaponSwingProgress * Math.PI) : 0;

    const baseX = 248 - swingArc * 135;
    const baseY = 395 - swingArc * 75 + bob * 1.2;
    const tipX = 205 - swingArc * 165;
    const tipY = 235 + swingArc * 45 + bob * 1.2;

    gCtx.save();
    gCtx.strokeStyle = 'rgb(215, 145, 220)';
    gCtx.lineWidth = 9;
    gCtx.beginPath();
    gCtx.moveTo(baseX, baseY);
    gCtx.lineTo(tipX, tipY);
    gCtx.stroke();

    gCtx.strokeStyle = 'rgb(180, 215, 190)';
    gCtx.lineWidth = 5;
    gCtx.beginPath();
    gCtx.moveTo(baseX - 24, baseY - 22);
    gCtx.lineTo(baseX + 18, baseY - 36);
    gCtx.stroke();
    gCtx.restore();
  }

  function checkPlayerMeleeHit() {
    const cam = getCameraState();
    const diffMult =
      V.Settings && typeof V.Settings.getDifficultyMultiplier === 'function'
        ? V.Settings.getDifficultyMultiplier()
        : 1.0;
    const rotPenalty =
      V.Shader && typeof V.Shader.getRotTNPenalty === 'function'
        ? V.Shader.getRotTNPenalty()
        : (V.State?.rotTier >= 4 ? 2 : 0);

    const playerAV =
      V.Character && typeof V.Character.computeActionValue === 'function'
        ? V.Character.computeActionValue('brawn', 'melee', 'MELEE', false)
        : 7;

    for (const ent of entities) {
      if (ent.aiState === 'SLAIN') continue;
      const dx = ent.x - cam.x;
      const dy = ent.y - cam.y;
      const dist = Math.hypot(dx, dy);
      const dot = (dx * cam.dirX + dy * cam.dirY) / Math.max(0.01, dist);

      if (dist <= 1.8 && dot > 0.62) {
        ent.spectralHidden = false;
        const targetTN = Math.round(ent.baseTN * diffMult) + rotPenalty;
        if (playerAV >= targetTN) {
          ent.takeDeterministicStrike(1);
          logBillboard(
            `STRIKE CONNECTS // AV [${playerAV}] >= TN [${targetTN}]. <u class="mech-term">${ent.name.toUpperCase()}</u> STAGGERS!`
          );
        } else {
          const gap = targetTN - playerAV;
          logBillboard(
            `BLADE GLANCES OFF ARMOR // AV [${playerAV}] < TN [${targetTN}] (REQUIRES +${gap} AV OR SOLACE).`,
            true
          );
        }
        return;
      }
    }
  }

  function updateAndRender(time, dt) {
    for (const ent of entities) {
      ent.updateAI(time, dt);
    }
    projectSpritesIntoGBuffer(time);
    updateAndRenderWeapon(time, dt);
  }

  function renderStaticFrozen(time) {
    projectSpritesIntoGBuffer(time);
    updateAndRenderWeapon(time, 0);
  }

  V.Billboard = {
    spawnFloorEntities,
    updateAndRender,
    render: (time, dt = 0.033) => {
      if (V.State && V.State.mode === 'AUTO_PAUSE') {
        renderStaticFrozen(time);
      } else {
        updateAndRender(time, dt);
      }
    },
    renderStaticFrozen,
    triggerSwing: () => {
      if (weaponSwingProgress === 0) weaponSwingProgress = 0.001;
    },
    getEntities: () => entities,
    getEntityById: (id) => entities.find((e) => e.id === id)
  };
})();

