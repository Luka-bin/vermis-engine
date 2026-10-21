/**
 * VERMIS ENGINE // MODULE 02: LITHOGRAPHY SHADER CORE [v1.4.1]
 * File: js/core/lithography.js
 * Purpose: Shared Volumetric G-Buffer to 8x8 Ordered Bayer + FBM Mezzotint Uint32Array Shader,
 *          Rot Tier 1-4 Degradation, Live 3D Raycast Compositing, and Spectral Loupe X-Ray Pass.
 */
(function () {
  'use strict';

  const VERMIS = (window.VERMIS = window.VERMIS || {});

  VERMIS.Config = Object.assign(
    {
      width: 320,
      height: 400,
      loupeSize: 96,
      fps: 12,
      shaderMode: 'plastiboo', // 'plastiboo' | 'bayer' | 'gbuffer'
      palette: 'catacombs',    // 'catacombs' | 'flutewoods' | 'brutalist' | 'graveyard' | 'swamp'
      grainIntensity: 0.65,
      scanlines: true,
      crtEnabled: true,
      loupeEnabled: true,
      rotTier: 1,              // 1 to 4 (scales dither decay, proximity fog, and +2 TN at Tier 4)
      gyroEnabled: false,      // Strictly locked OFF by default per v1.4.1 spec
      touchDeckEnabled: false,
      difficultyMultiplier: 1.0
    },
    VERMIS.Config || {}
  );

  const W = VERMIS.Config.width || 320;
  const H = VERMIS.Config.height || 400;
  const LOUPE_W = VERMIS.Config.loupeSize || 96;

  // Pack 8-bit RGB into Little-Endian ABGR 32-bit unsigned integer for Uint32Array
  function packABGR(r, g, b, a = 255) {
    return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
  }

  // Spot-Color Lithography Palettes
  const PALETTES = {
    catacombs: {
      inkBlack:     packABGR(8, 9, 7),
      deepMoss:     packABGR(24, 42, 23),
      midMoss:      packABGR(52, 83, 41),
      brightMoss:   packABGR(102, 134, 66),
      boneLight:    packABGR(188, 178, 138),
      darkRust:     packABGR(92, 28, 16),
      midRust:      packABGR(168, 56, 28),
      brightRust:   packABGR(214, 96, 45),
      spectralGlow: packABGR(210, 235, 195),
      borderInk:    packABGR(185, 62, 28)
    },
    flutewoods: {
      inkBlack:     packABGR(6, 9, 6),
      deepMoss:     packABGR(16, 36, 18),
      midMoss:      packABGR(38, 74, 34),
      brightMoss:   packABGR(86, 134, 62),
      boneLight:    packABGR(158, 192, 116),
      darkRust:     packABGR(22, 44, 20),
      midRust:      packABGR(46, 88, 38),
      brightRust:   packABGR(96, 148, 68),
      spectralGlow: packABGR(220, 255, 180),
      borderInk:    packABGR(64, 108, 48)
    },
    brutalist: {
      inkBlack:     packABGR(0, 0, 0),
      deepMoss:     packABGR(26, 26, 26),
      midMoss:      packABGR(78, 78, 74),
      brightMoss:   packABGR(164, 160, 150),
      boneLight:    packABGR(255, 255, 255),
      darkRust:     packABGR(68, 12, 18),
      midRust:      packABGR(155, 20, 36),
      brightRust:   packABGR(255, 0, 60),
      spectralGlow: packABGR(168, 255, 178),
      borderInk:    packABGR(255, 255, 255)
    },
    graveyard: {
      inkBlack:     packABGR(12, 11, 9),
      deepMoss:     packABGR(42, 40, 32),
      midMoss:      packABGR(92, 88, 64),
      brightMoss:   packABGR(168, 162, 98),
      boneLight:    packABGR(218, 212, 142),
      darkRust:     packABGR(78, 46, 28),
      midRust:      packABGR(138, 78, 42),
      brightRust:   packABGR(196, 122, 62),
      spectralGlow: packABGR(240, 236, 180),
      borderInk:    packABGR(148, 140, 96)
    },
    swamp: {
      inkBlack:     packABGR(14, 14, 12),
      deepMoss:     packABGR(46, 48, 42),
      midMoss:      packABGR(98, 100, 88),
      brightMoss:   packABGR(154, 152, 136),
      boneLight:    packABGR(208, 204, 186),
      darkRust:     packABGR(62, 54, 46),
      midRust:      packABGR(112, 98, 84),
      brightRust:   packABGR(164, 148, 128),
      spectralGlow: packABGR(235, 235, 225),
      borderInk:    packABGR(98, 100, 88)
    }
  };

  // Precompute normalized 8x8 Ordered Bayer Matrix (-0.5 to +0.5)
  const BAYER_8X8 = new Float32Array(64);
  const RAW_BAYER = [
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  ];
  for (let i = 0; i < 64; i++) {
    BAYER_8X8[i] = RAW_BAYER[i] / 64.0 - 0.5;
  }

  function hash2D(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);
    const a = hash2D(ix, iy);
    const b = hash2D(ix + 1, iy);
    const c = hash2D(ix, iy + 1);
    const d = hash2D(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y) {
    return (
      0.55 * valueNoise(x, y) +
      0.30 * valueNoise(x * 2.13, y * 2.13) +
      0.15 * valueNoise(x * 4.41, y * 4.41)
    );
  }

  class LithographyShader {
    constructor() {
      this.width = W;
      this.height = H;

      this.displayCanvas =
        document.getElementById('visual-stage-canvas') ||
        document.getElementById('displayCanvas');
      this.gBufferCanvas =
        document.getElementById('gbuffer-debug-canvas') ||
        document.createElement('canvas');
      this.loupeCanvas =
        document.getElementById('loupe-canvas') ||
        document.getElementById('loupeCanvas');

      this.gBufferCanvas.width = W;
      this.gBufferCanvas.height = H;
      this.gCtx = this.gBufferCanvas.getContext('2d', { willReadFrequently: true });

      if (this.displayCanvas) {
        this.displayCanvas.width = W;
        this.displayCanvas.height = H;
        this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
        this.outImg = this.displayCtx.createImageData(W, H);
        this.outBuf32 = new Uint32Array(this.outImg.data.buffer);
      }

      if (this.loupeCanvas) {
        this.loupeCanvas.width = LOUPE_W;
        this.loupeCanvas.height = LOUPE_W;
        this.loupeCtx = this.loupeCanvas.getContext('2d', { willReadFrequently: true });
        this.loupeImg = this.loupeCtx.createImageData(LOUPE_W, LOUPE_W);
        this.loupeBuf32 = new Uint32Array(this.loupeImg.data.buffer);
      }

      this.paperGrain = new Float32Array(W * H);
      this.bgArchMask = new Uint8Array(W * H);
      this.bgLum = new Float32Array(W * H);
      this.depthBuffer = new Float32Array(W * H);

      this._initStaticFields();
      this._bindPreferenceButtons();
    }

    _initStaticFields() {
      const archCenterX = W * 0.44;
      const archSpringY = 128;
      const archRadius = 88;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const n1 = hash2D(x, y) - 0.5;
          const n2 = fbm(x * 0.08, y * 0.08) - 0.5;
          this.paperGrain[i] = n1 * 0.65 + n2 * 0.35;
          this.depthBuffer[i] = 1.0;

          let distToArch = 999;
          if (y < archSpringY) {
            distToArch = Math.hypot(x - archCenterX, y - archSpringY) - archRadius;
          } else {
            distToArch = Math.abs(x - archCenterX) - archRadius;
          }

          const brickRow = Math.floor(y / 18);
          const brickOffset = (brickRow % 2) * 22;
          const mortar = y % 18 < 2 || (x + brickOffset) % 44 < 2 ? -0.18 : 0.0;
          const stoneTex = fbm(x * 0.06, y * 0.06);

          const vx = (x - W * 0.5) / (W * 0.55);
          const vy = (y - H * 0.48) / (H * 0.55);
          const vignette = Math.max(0, 1.0 - (vx * vx * 0.65 + vy * vy * 0.75));

          if (distToArch < -5) {
            this.bgArchMask[i] = 1;
            const innerGrad = Math.max(0.15, 1.0 - Math.max(0, (y - 50) / 330));
            this.bgLum[i] =
              (0.42 + innerGrad * 0.48 + (stoneTex - 0.5) * 0.22 + mortar * 0.4) * vignette;
          } else if (distToArch < 7) {
            this.bgArchMask[i] = 2;
            this.bgLum[i] = (0.22 + stoneTex * 0.25 + mortar) * vignette;
          } else {
            this.bgArchMask[i] = 0;
            this.bgLum[i] = (0.14 + stoneTex * 0.34 + mortar) * vignette;
          }
        }
      }
    }

    /**
     * Hooks into Module 01 #preferences-modal calibration buttons if present
     */
    _bindPreferenceButtons() {
      const paletteOrder = ['catacombs', 'flutewoods', 'brutalist', 'graveyard', 'swamp'];
      const btnPalette = document.getElementById('btn-palette-modal');
      if (btnPalette) {
        btnPalette.addEventListener('click', () => {
          const idx = paletteOrder.indexOf(VERMIS.Config.palette);
          const next = paletteOrder[(idx + 1) % paletteOrder.length];
          VERMIS.Config.palette = next;
          btnPalette.textContent = `PLATE: ${next.toUpperCase()}`;
          document.body.className = document.body.className.replace(/palette-\w+/g, `palette-${next}`);
        });
      }

      const btnCrt = document.getElementById('btn-crt-modal');
      if (btnCrt) {
        btnCrt.addEventListener('click', () => {
          VERMIS.Config.scanlines = !VERMIS.Config.scanlines;
          VERMIS.Config.crtEnabled = VERMIS.Config.scanlines;
          btnCrt.textContent = `CRT: ${VERMIS.Config.scanlines ? 'ON' : 'OFF'}`;
          btnCrt.classList.toggle('active', VERMIS.Config.scanlines);
          document.body.classList.toggle('crt-enabled', VERMIS.Config.scanlines);
        });
      }

      const btnFps = document.getElementById('btn-fps-modal');
      if (btnFps) {
        const fpsSteps = [12, 24, 60];
        btnFps.addEventListener('click', () => {
          const idx = fpsSteps.indexOf(VERMIS.Config.fps);
          const next = fpsSteps[(idx + 1) % fpsSteps.length];
          VERMIS.Config.fps = next;
          btnFps.textContent = `${next} FPS`;
        });
      }
    }

    clearGBuffer() {
      this.gCtx.clearRect(0, 0, W, H);
    }

    drawSphereVolume(x, y, radius, matID = 120, lumBoost = 1.0, alpha = 1.0) {
      if (radius <= 0.5) return;
      const gCtx = this.gCtx;
      const lx = x - radius * 0.32;
      const ly = y - radius * 0.35;
      const grad = gCtx.createRadialGradient(lx, ly, radius * 0.08, x, y, radius);
      const hi = Math.min(252, Math.round(220 * lumBoost));
      const mid = Math.min(220, Math.round(120 * lumBoost));

      grad.addColorStop(0.0, `rgba(${hi}, ${matID}, 210, ${alpha})`);
      grad.addColorStop(0.55, `rgba(${mid}, ${matID}, 120, ${alpha})`);
      grad.addColorStop(1.0, `rgba(14, ${matID}, 25, ${alpha})`);

      gCtx.fillStyle = grad;
      gCtx.beginPath();
      gCtx.arc(x, y, radius, 0, Math.PI * 2);
      gCtx.fill();
    }

    drawBoneSegment(x1, y1, x2, y2, r1, r2, matID = 125, lumBoost = 1.0, alpha = 1.0) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) return;
      const nx = -dy / len;
      const ny = dx / len;
      const cx = (x1 + x2) * 0.5;
      const cy = (y1 + y2) * 0.5;
      const maxR = Math.max(r1, r2) * 1.3;

      const gCtx = this.gCtx;
      const grad = gCtx.createLinearGradient(
        cx - nx * maxR,
        cy - ny * maxR,
        cx + nx * maxR,
        cy + ny * maxR
      );

      const hi = Math.min(250, Math.round(215 * lumBoost));
      const mid = Math.min(240, Math.round(135 * lumBoost));
      const low = Math.min(200, Math.round(35 * lumBoost));

      grad.addColorStop(0.0, `rgba(${low}, ${matID}, 40, ${alpha})`);
      grad.addColorStop(0.32, `rgba(${hi}, ${matID}, 180, ${alpha})`);
      grad.addColorStop(0.7, `rgba(${mid}, ${matID}, 110, ${alpha})`);
      grad.addColorStop(1.0, `rgba(18, ${matID}, 30, ${alpha})`);

      gCtx.fillStyle = grad;
      gCtx.beginPath();
      gCtx.moveTo(x1 - nx * r1, y1 - ny * r1);
      gCtx.quadraticCurveTo(
        cx - nx * ((r1 + r2) * 0.36),
        cy - ny * ((r1 + r2) * 0.36),
        x2 - nx * r2,
        y2 - ny * r2
      );
      gCtx.arc(x2, y2, r2 * 1.15, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
      gCtx.quadraticCurveTo(
        cx + nx * ((r1 + r2) * 0.36),
        cy + ny * ((r1 + r2) * 0.36),
        x1 + nx * r1,
        y1 + ny * r1
      );
      gCtx.arc(x1, y1, r1 * 1.15, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
      gCtx.closePath();
      gCtx.fill();

      this.drawSphereVolume(x1, y1, r1 * 1.2, matID, lumBoost * 0.92, alpha);
      this.drawSphereVolume(x2, y2, r2 * 1.2, matID, lumBoost * 0.92, alpha);
    }

    /**
     * Quantize material & dithered luminance into 32-bit ABGR color
     */
    _quantizeMaterialPixel(v, gMat, pal) {
      if (gMat > 180) {
        if (v < 0.25) return pal.inkBlack;
        if (v < 0.48) return pal.darkRust;
        if (v < 0.74) return pal.midRust;
        return pal.brightRust;
      }
      if (gMat > 110) {
        if (v < 0.24) return pal.inkBlack;
        if (v < 0.46) return pal.deepMoss;
        if (v < 0.68) return pal.midMoss;
        if (v < 0.86) return pal.brightMoss;
        return pal.boneLight;
      }
      if (v < 0.30) return pal.inkBlack;
      if (v < 0.56) return pal.deepMoss;
      if (v < 0.80) return pal.midMoss;
      return pal.brightMoss;
    }

    /**
     * Executes the primary Uint32Array Lithography Pass onto #visual-stage-canvas.
     * Supports both 3D Raycast G-Buffer backgrounds (alpha === 64) and Foreground Rigs (alpha >= 95).
     */
    renderPass(timeSec = 0) {
      if (!this.displayCtx) return;

      const cfg = VERMIS.Config;
      const gData = this.gCtx.getImageData(0, 0, W, H).data;
      const outBuf32 = this.outBuf32;

      if (cfg.shaderMode === 'gbuffer') {
        for (let i = 0; i < W * H; i++) {
          const idx4 = i << 2;
          if (gData[idx4 + 3] > 20) {
            outBuf32[i] = packABGR(gData[idx4], gData[idx4 + 1], gData[idx4 + 2]);
          } else {
            const b = Math.round(this.bgLum[i] * 90);
            outBuf32[i] = packABGR(b, b, b + 18);
          }
        }
        this.displayCtx.putImageData(this.outImg, 0, 0);
        return;
      }

      const pal = PALETTES[cfg.palette] || PALETTES.catacombs;
      const isStrictBayer = cfg.shaderMode === 'bayer';
      const activeRot =
        (VERMIS.State && VERMIS.State.rotTier) || cfg.rotTier || 1;
      const rotTier = Math.max(1, Math.min(4, activeRot));

      const rotNoiseBoost = (rotTier - 1) * 0.11;
      const rotFogAttenuation = 1.0 - (rotTier - 1) * 0.14;
      const grainAmt = isStrictBayer ? 0.0 : cfg.grainIntensity * 0.36 + rotNoiseBoost;
      const scanlineOn = cfg.scanlines;

      for (let y = 0; y < H; y++) {
        const bayerRow = (y & 7) << 3;
        const scanMod = scanlineOn && (y & 1) ? -0.055 : 0.0;

        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const idx4 = i << 2;

          // 3px Hard Plate Border
          if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) {
            outBuf32[i] = pal.borderInk;
            continue;
          }

          const bayerVal = BAYER_8X8[bayerRow | (x & 7)];
          const dither = bayerVal * 0.42 + this.paperGrain[i] * grainAmt + scanMod;

          const alpha = gData[idx4 + 3];
          const gMat = gData[idx4 + 1];
          const isSpectral = gMat >= 240;

          // 1. Foreground Entity / Billboard Rig (alpha >= 95)
          if (alpha >= 95 && !isSpectral) {
            const rLum = (gData[idx4] / 255.0) * rotFogAttenuation;

            let isContour = false;
            if (x > 4 && x < W - 4 && y > 4 && y < H - 4) {
              const rightA = gData[idx4 + 7];
              const downA = gData[idx4 + W * 4 + 3];
              const rightL = gData[idx4 + 4];
              if (rightA < 95 || downA < 95 || Math.abs(gData[idx4] - rightL) > 78) {
                isContour = true;
              }
            }

            if (isContour && rLum + dither < 0.58) {
              outBuf32[i] = pal.inkBlack;
              continue;
            }

            outBuf32[i] = this._quantizeMaterialPixel(rLum + dither, gMat, pal);
          }
          // 2. 3D Raycast Labyrinth Geometry (tagged by raycaster.js with alpha === 64)
          else if (alpha >= 50 && alpha < 95) {
            let wallLum = gData[idx4] / 255.0;

            // Cast stippled shadow from any foreground creature onto the 3D dungeon wall/floor
            if (x >= 10 && y >= 8) {
              const shadowIdx4 = ((y - 6) * W + (x - 8)) << 2;
              if (gData[shadowIdx4 + 3] >= 95 && gData[shadowIdx4 + 1] < 240) {
                wallLum *= 0.45;
              }
            }

            outBuf32[i] = this._quantizeMaterialPixel(wallLum + dither, gMat, pal);
          }
          // 3. Static Fallback Catacomb Archway + Translucent Miasma Spores
          else {
            let bLum = this.bgLum[i] * rotFogAttenuation;

            if (x >= 10 && y >= 8) {
              const shadowIdx4 = ((y - 6) * W + (x - 8)) << 2;
              if (gData[shadowIdx4 + 3] >= 95 && gData[shadowIdx4 + 1] < 240) {
                bLum *= 0.42;
              }
            }

            if (isSpectral && alpha > 30) {
              bLum += this.paperGrain[i] * 0.18;
            } else if (alpha > 8) {
              bLum += (alpha / 95.0) * 0.42;
            }

            const v = bLum + dither;
            if (this.bgArchMask[i] === 1 && alpha <= 18 && rotTier < 4) {
              outBuf32[i] = this._quantizeMaterialPixel(v, 210, pal);
            } else {
              outBuf32[i] = this._quantizeMaterialPixel(v, 90, pal);
            }
          }
        }
      }

      this.displayCtx.putImageData(this.outImg, 0, 0);
    }

    /**
     * Executes the Diegetic Loupe X-Ray Pass onto #loupe-canvas
     */
    renderLoupePass(stageX = 160, stageY = 200) {
      if (!this.loupeCtx || !this.displayCanvas) return false;

      const cfg = VERMIS.Config;
      const pal = PALETTES[cfg.palette] || PALETTES.catacombs;
      const gData = this.gCtx.getImageData(0, 0, W, H).data;
      const loupeBuf32 = this.loupeBuf32;

      const zoom = 1.5;
      const halfL = LOUPE_W * 0.5;
      let spectralDetected = false;

      for (let ly = 0; ly < LOUPE_W; ly++) {
        const bayerRow = (ly & 7) << 3;
        for (let lx = 0; lx < LOUPE_W; lx++) {
          const outIdx = ly * LOUPE_W + lx;
          const dx = lx - halfL;
          const dy = ly - halfL;
          if (dx * dx + dy * dy > halfL * halfL) {
            loupeBuf32[outIdx] = 0;
            continue;
          }

          const sx = Math.floor(stageX + dx / zoom);
          const sy = Math.floor(stageY + dy / zoom);

          if (sx < 0 || sx >= W || sy < 0 || sy >= H) {
            loupeBuf32[outIdx] = pal.inkBlack;
            continue;
          }

          const sIdx = sy * W + sx;
          const idx4 = sIdx << 2;
          const alpha = gData[idx4 + 3];
          const gMat = gData[idx4 + 1];
          const bayerVal = BAYER_8X8[bayerRow | (lx & 7)];

          if (gMat >= 240 && alpha > 35) {
            spectralDetected = true;
            const specLum = gData[idx4] / 255.0 + bayerVal * 0.35;
            loupeBuf32[outIdx] = specLum > 0.38 ? pal.spectralGlow : pal.midRust;
          } else if (alpha >= 50) {
            const lum = gData[idx4] / 255.0 + bayerVal * 0.3;
            if (lum < 0.3) loupeBuf32[outIdx] = pal.inkBlack;
            else if (lum < 0.62) loupeBuf32[outIdx] = pal.midMoss;
            else loupeBuf32[outIdx] = pal.boneLight;
          } else {
            const bLum = this.bgLum[sIdx] + bayerVal * 0.35;
            loupeBuf32[outIdx] = bLum > 0.42 ? pal.deepMoss : pal.inkBlack;
          }
        }
      }

      this.loupeCtx.putImageData(this.loupeImg, 0, 0);

      this.loupeCtx.strokeStyle = spectralDetected ? '#ff003c' : '#c8bf9e';
      this.loupeCtx.lineWidth = 2;
      this.loupeCtx.beginPath();
      this.loupeCtx.arc(halfL, halfL, halfL - 2, 0, Math.PI * 2);
      this.loupeCtx.stroke();

      return spectralDetected;
    }

    setRotTier(tier) {
      const clamped = Math.max(1, Math.min(4, parseInt(tier, 10) || 1));
      VERMIS.Config.rotTier = clamped;
      if (VERMIS.State) VERMIS.State.rotTier = clamped;
      return clamped === 4 ? 2 : 0;
    }
  }

  VERMIS.LithographyShader = LithographyShader;
  VERMIS.PALETTES = PALETTES;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      VERMIS.Shader = new LithographyShader();
    });
  } else {
    VERMIS.Shader = new LithographyShader();
  }
})();

