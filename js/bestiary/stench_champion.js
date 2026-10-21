/**
 * VERMIS ENGINE // MODULE 04: THE BESTIARY (v1.4.1)
 * File: js/bestiary/stench_champion.js
 * Entity: The Stench Champion (Catacombs Exit)
 * G-Buffer Encoding: R = Luminance, G = Material (70=Moss/Sinew, 135=Bone, 220=Rust/Iron), B = Edge Depth
 */
(function () {
  'use strict';

  window.VERMIS = window.VERMIS || {};
  window.VERMIS.Bestiary = window.VERMIS.Bestiary || {};

  const BUFFER_W = 320;
  const BUFFER_H = 400;

  // Offscreen G-Buffer canvas for standalone or billboard compositing
  const offCanvas = document.createElement('canvas');
  offCanvas.width = BUFFER_W;
  offCanvas.height = BUFFER_H;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

  // Miasma spore particle pool deflected by Catacomb Breeze
  const spores = Array.from({ length: 44 }, (_, i) => ({
    x: 85 + ((i * 37) % 150),
    y: 70 + ((i * 53) % 280),
    r: 1.3 + (i % 4) * 0.75,
    vy: -14 - (i % 5) * 4.5,
    phase: i * 0.45,
    alpha: 0.35 + (i % 3) * 0.2
  }));

  function drawSphereVolume(ctx, x, y, radius, matID, lumBoost) {
    if (radius <= 0.5) return;
    const lx = x - radius * 0.32;
    const ly = y - radius * 0.35;
    const grad = ctx.createRadialGradient(lx, ly, radius * 0.08, x, y, radius);
    const hi = Math.min(252, Math.round(220 * lumBoost));
    const mid = Math.min(225, Math.round(122 * lumBoost));
    grad.addColorStop(0.0, `rgb(${hi}, ${matID}, 210)`);
    grad.addColorStop(0.55, `rgb(${mid}, ${matID}, 120)`);
    grad.addColorStop(1.0, `rgb(14, ${matID}, 25)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBoneSegment(ctx, x1, y1, x2, y2, r1, r2, matID, lumBoost) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const nx = -dy / len;
    const ny = dx / len;

    const cx = (x1 + x2) * 0.5;
    const cy = (y1 + y2) * 0.5;
    const maxR = Math.max(r1, r2) * 1.3;

    const grad = ctx.createLinearGradient(
      cx - nx * maxR, cy - ny * maxR,
      cx + nx * maxR, cy + ny * maxR
    );

    const hi = Math.min(250, Math.round(215 * lumBoost));
    const mid = Math.min(240, Math.round(135 * lumBoost));
    const low = Math.min(200, Math.round(35 * lumBoost));

    grad.addColorStop(0.0, `rgb(${low}, ${matID}, 40)`);
    grad.addColorStop(0.32, `rgb(${hi}, ${matID}, 180)`);
    grad.addColorStop(0.7, `rgb(${mid}, ${matID}, 110)`);
    grad.addColorStop(1.0, `rgb(18, ${matID}, 30)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * r1, y1 - ny * r1);
    ctx.quadraticCurveTo(
      cx - nx * ((r1 + r2) * 0.36),
      cy - ny * ((r1 + r2) * 0.36),
      x2 - nx * r2, y2 - ny * r2
    );
    ctx.arc(x2, y2, r2 * 1.15, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
    ctx.quadraticCurveTo(
      cx + nx * ((r1 + r2) * 0.36),
      cy + ny * ((r1 + r2) * 0.36),
      x1 + nx * r1, y1 + ny * r1
    );
    ctx.arc(x1, y1, r1 * 1.15, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    ctx.closePath();
    ctx.fill();

    drawSphereVolume(ctx, x1, y1, r1 * 1.2, matID, lumBoost * 0.92);
    drawSphereVolume(ctx, x2, y2, r2 * 1.2, matID, lumBoost * 0.92);
  }

  function drawSinewStrand(ctx, x1, y1, x2, y2, sag, windForce, matID) {
    const mx = (x1 + x2) * 0.5 + windForce * sag * 0.45;
    const my = (y1 + y2) * 0.5 + sag;
    ctx.strokeStyle = `rgb(75, ${matID}, 90)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.stroke();
  }

  function drawCentipedeSpineArch(ctx, startX, startY, dir, t, spasm, breath) {
    const segments = 16;
    let px = startX;
    let py = startY;
    let baseAngle = dir < 0 ? -Math.PI * 0.72 : -Math.PI * 0.28;

    for (let i = 0; i < segments; i++) {
      const frac = i / segments;
      const wave = Math.sin(t * 3.2 - i * 0.45) * 0.08 + spasm * Math.sin(t * 28 + i * 1.7) * 0.14;
      const curve = dir * (0.14 + frac * 0.11) + wave + (breath * 0.04 * dir);
      baseAngle += curve;

      const segLen = 6.2 * (1.0 - frac * 0.35);
      const nx = px + Math.cos(baseAngle) * segLen;
      const ny = py + Math.sin(baseAngle) * segLen;
      const radius = 5.2 * (1.0 - frac * 0.55);

      const perpX = -Math.sin(baseAngle);
      const perpY = Math.cos(baseAngle);
      const legFlick = Math.sin(t * 5.5 - i * 0.8 + spasm * 10) * 3.5;

      ctx.strokeStyle = `rgb(145, 85, 160)`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        px + perpX * dir * (radius * 2.4 + 4) + Math.cos(baseAngle) * legFlick * 0.4,
        py + perpY * dir * (radius * 2.4 + 4) + Math.sin(baseAngle) * legFlick * 0.4
      );
      ctx.moveTo(px, py);
      ctx.lineTo(
        px - perpX * dir * (radius * 1.7 + 2),
        py - perpY * dir * (radius * 1.7 + 2)
      );
      ctx.stroke();

      drawSphereVolume(ctx, px, py, radius, 105, 0.95 - frac * 0.25);
      px = nx;
      py = ny;
    }
  }

  function drawDetailedSkull(ctx, x, y, scale, tilt, jawOpen, isHelmed, matID) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);

    drawSphereVolume(ctx, 0, 2, 16, 45, 0.25);
    drawSphereVolume(ctx, 0, -3, 14.5, isHelmed ? 215 : matID, isHelmed ? 1.05 : 1.0);
    drawSphereVolume(ctx, -7, 5, 6.5, matID, 0.88);
    drawSphereVolume(ctx, 6, 5, 6.5, matID, 0.82);

    const jy = 11 + jawOpen * 4.5;
    drawSphereVolume(ctx, -0.5, jy, 7.5, matID, 0.72);

    ctx.fillStyle = `rgb(6, 30, 10)`;
    ctx.beginPath();
    ctx.ellipse(-5.2, 2.5, 4.2, 3.6, -0.15, 0, Math.PI * 2);
    ctx.ellipse(5.0, 2.5, 4.0, 3.5, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 4.5);
    ctx.lineTo(-2.4, 9.2);
    ctx.lineTo(2.2, 9.2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgb(210, 145, 200)`;
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * 2.1 - 0.7, 9.5, 1.3, 2.4);
      ctx.fillRect(i * 2.0 - 0.7, jy - 1.5, 1.2, 2.0);
    }

    if (isHelmed) {
      ctx.strokeStyle = `rgb(230, 235, 220)`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, -1, 15.2, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      ctx.lineWidth = 1.4;
      for (let b = -2; b <= 2; b++) {
        ctx.beginPath();
        ctx.moveTo(b * 3.6, -2);
        ctx.lineTo(b * 3.0, 12);
        ctx.stroke();
      }
      drawBoneSegment(ctx, 0, -15, -1, -23, 2.8, 0.8, 225, 1.1);
    }

    ctx.restore();
  }

  const StenchChampion = {
    id: 'STENCH_CHAMPION',
    name: 'The Stench Champion',
    lorePlate: 'Catacombs Exit',
    baseStats: {
      targetNumber: 14,
      solaceDrain: 2,
      telegraphWindow: 1.5,
      complicationOnHit: 'Infection',
      miasmaHazard: true
    },
    spasmImpulse: 0.0,

    triggerSpasm: function (strength = 1.1) {
      this.spasmImpulse = Math.max(this.spasmImpulse, strength);
    },

    /**
     * Renders the Stench Champion into a target 2D canvas context (or internal offscreen G-Buffer).
     * @param {CanvasRenderingContext2D} targetCtx
     * @param {number} t - Quantized animation time in seconds
     * @param {number} dt - Frame delta in seconds
     * @param {Object} opts - { fsmState: 'DORMANT'|'AGGRO'|'TELEGRAPH'|'IMPACT', wind: -0.35, breathScale: 1.0, clear: true }
     */
    renderRig: function (targetCtx, t, dt, opts = {}) {
      const ctx = targetCtx || offCtx;
      const fsm = (opts.fsmState || opts.mode || 'DORMANT').toUpperCase();
      const wind = typeof opts.wind === 'number' ? opts.wind : -0.35;
      const bScale = typeof opts.breathScale === 'number' ? opts.breathScale : 1.0;

      if (opts.clear !== false) {
        ctx.clearRect(0, 0, BUFFER_W, BUFFER_H);
      }

      this.spasmImpulse *= Math.exp(-(dt || 0.08) * 4.5);
      if (fsm === 'TELEGRAPH' || fsm === 'CONVULSE') {
        this.spasmImpulse = Math.max(this.spasmImpulse, 0.65 + 0.35 * Math.sin(t * 19.0));
      }

      const sp = this.spasmImpulse;
      const isTelegraph = fsm === 'TELEGRAPH' || fsm === 'AGGRO' || fsm === 'IMPACT';
      const lumFlash = fsm === 'TELEGRAPH' ? 1.25 : 1.0;

      const jitterX = (Math.sin(t * 47.3) + Math.cos(t * 63.1)) * sp * 3.2;
      const jitterY = (Math.cos(t * 53.7) - Math.sin(t * 39.4)) * sp * 2.6;

      // 3 Asynchronous Respiratory Oscillators
      const breath1 = Math.sin(t * 1.85) * bScale;
      const breath2 = Math.sin(t * 2.45 + 1.9) * bScale;
      const breath3 = Math.sin(t * 1.35 + 4.1) * bScale;

      const aggroLift = isTelegraph ? -14 + Math.sin(t * 4.0) * 3 : 0;
      const swayX = Math.sin(t * 0.95) * 4.5 + wind * 4.0 + jitterX;
      const swayY = Math.abs(Math.cos(t * 0.95)) * 3.5 + breath1 * 2.2 + aggroLift * 0.4 + jitterY;

      const pelvisX = 136 + swayX * 0.55;
      const pelvisY = 232 + swayY * 0.6;
      const chestX = 132 + swayX;
      const chestY = 148 + swayY - breath1 * 3.2;

      // 1. Miasma Spores
      const miasmaBoost = fsm === 'MIASMA' || fsm === 'TELEGRAPH' ? 2.2 : 1.0;
      for (let i = 0; i < spores.length; i++) {
        const s = spores[i];
        s.y += s.vy * (dt || 0.08) * miasmaBoost;
        s.x += (wind * 26 + Math.sin(t * 2.0 + s.phase) * 10) * (dt || 0.08);
        if (s.y < 25) {
          s.y = 335 + (i % 35);
          s.x = 75 + ((i * 29) % 165);
        }
        if (s.x < 20) s.x = BUFFER_W - 25;
        if (s.x > BUFFER_W - 20) s.x = 25;

        const rad = s.r * (miasmaBoost > 1 ? 1.5 : 1.0);
        ctx.fillStyle = `rgba(155, 65, 120, ${Math.min(0.45, s.alpha * 0.35 * miasmaBoost)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Necrotic Core Silhouette Mass
      ctx.fillStyle = `rgb(14, 48, 30)`;
      ctx.beginPath();
      ctx.ellipse(chestX - 4, chestY + 26, 46 + breath1 * 2.5, 64, -0.08, 0, Math.PI * 2);
      ctx.fill();

      // 3. Lower Skeletal Legs
      const footLX = 104, footLY = 366;
      const footRX = 166, footRY = 374;
      const kneeLX = 96 + swayX * 0.35 - breath2 * 1.2;
      const kneeLY = 300 + swayY * 0.3;
      const kneeRX = 178 + swayX * 0.4 + breath1 * 1.5;
      const kneeRY = 304 + swayY * 0.3;

      drawBoneSegment(ctx, pelvisX - 18, pelvisY + 12, kneeLX, kneeLY, 6.5, 5.0, 115, 0.85);
      drawBoneSegment(ctx, kneeLX, kneeLY, footLX, footLY, 4.8, 3.5, 115, 0.82);
      drawBoneSegment(ctx, kneeLX + 5, kneeLY + 2, footLX + 4, footLY - 2, 2.5, 2.0, 95, 0.7);
      for (let c = -2; c <= 1; c++) {
        drawBoneSegment(ctx, footLX, footLY, footLX + c * 7 - 5, footLY + 9, 2.2, 1.0, 125, 0.8);
      }

      drawBoneSegment(ctx, pelvisX + 14, pelvisY + 10, kneeRX, kneeRY, 7.0, 5.2, 120, 0.92);
      drawBoneSegment(ctx, kneeRX, kneeRY, footRX, footRY, 4.5, 3.4, 125, 0.9);
      drawBoneSegment(ctx, kneeRX - 6, kneeRY + 3, footRX - 5, footRY - 2, 3.0, 2.2, 100, 0.75);
      for (let c = -1; c <= 2; c++) {
        drawBoneSegment(ctx, footRX, footRY, footRX + c * 7 + 3, footRY + 10, 2.4, 1.1, 130, 0.85);
      }

      // 4. Rusted Cleaver / Curved Greatsword Hilt
      const hx1 = pelvisX - 54, hy1 = pelvisY - 52 + aggroLift * 0.8;
      const hx2 = pelvisX - 18, hy2 = pelvisY + 18;
      drawBoneSegment(ctx, hx1, hy1, hx2, hy2, 4.4, 3.0, 225, 1.05 * lumFlash);
      drawBoneSegment(ctx, hx1 - 8, hy1 + 14, hx2 - 12, hy2 - 4, 2.5, 2.0, 210, 0.85 * lumFlash);

      // 5. Twin Centipede-Like Spinal Horns
      drawCentipedeSpineArch(ctx, chestX - 16, chestY - 42, -1, t, sp, breath1);
      drawCentipedeSpineArch(ctx, chestX + 22, chestY - 38,  1, t + 0.7, sp, breath2);

      // 6. Main Thoracic Ribcage
      for (let r = 0; r < 7; r++) {
        const rf = r / 6;
        const ry = chestY - 24 + r * 10.5 + breath1 * (r * 0.45);
        const ribSpread = (36 - Math.abs(r - 2.5) * 4.5) + breath1 * 3.2 * (1 - rf * 0.4);

        drawBoneSegment(ctx, chestX - 6, ry, chestX - ribSpread, ry + 7 + rf * 5, 3.6 - rf * 0.9, 2.2, 125, 0.98 - rf * 0.2);
        drawBoneSegment(ctx, chestX + 4, ry, chestX + ribSpread * 0.85, ry + 8 + rf * 5, 3.4 - rf * 0.9, 2.0, 105, 0.82 - rf * 0.2);
      }

      // 7. Abdomen-Embedded Grinning Skull
      const gutSkullX = pelvisX - 20 + Math.sin(t * 2.3) * 1.8;
      const gutSkullY = pelvisY - 8 + breath3 * 2.8;
      drawDetailedSkull(ctx, gutSkullX, gutSkullY, 1.05, -0.32 + sp * 0.25 + breath3 * 0.06, 0.35 + Math.max(0, Math.sin(t * 3.1 + 1.0)) * 0.4, false, 140);

      drawBoneSegment(ctx, pelvisX - 4, pelvisY + 4, pelvisX + 38, pelvisY - 12 + breath2 * 2, 4.5, 2.5, 130, 0.9);
      drawBoneSegment(ctx, pelvisX, pelvisY + 12, pelvisX + 34, pelvisY + 18 - breath3 * 2, 4.0, 2.2, 120, 0.85);

      // 8. Central Helmed Knight Head & Secondary Parasitic Shoulder Skull
      const mainHeadTilt = 0.22 + Math.sin(t * 1.4) * 0.06 - (isTelegraph ? 0.28 : 0) + sp * 0.3;
      drawDetailedSkull(ctx, chestX - 8, chestY - 40 + breath1 * 1.5, 1.18, mainHeadTilt, 0.2 + sp * 0.5, true, 210);

      const secHeadTilt = -0.42 + Math.cos(t * 2.1) * 0.09 + sp * -0.45;
      drawDetailedSkull(ctx, chestX + 28, chestY - 34 + breath2 * 2.4, 0.96, secHeadTilt, 0.45 + Math.sin(t * 3.8) * 0.35 + sp * 0.6, false, 145);

      // 9. Extended Skeletal Left Arm & Twitching Hand (Loupe Target)
      const shoulderOutX = chestX + 38;
      const shoulderOutY = chestY - 14 + breath2 * 2.2;
      const aggroArmAngle = isTelegraph ? -0.75 : 0.0;
      const elbowX = shoulderOutX + 46 + Math.cos(t * 1.6 + aggroArmAngle) * 3.5 + wind * 5.0;
      const elbowY = shoulderOutY + 18 + Math.sin(t * 1.6) * 3.5 + aggroLift * 1.2;

      drawBoneSegment(ctx, chestX + 16, chestY - 20, elbowX, elbowY, 5.5, 3.8, 125, 0.96);
      for (let k = 0; k < 6; k++) {
        const kf = k / 5;
        const sx = chestX + 20 + (elbowX - (chestX + 20)) * kf;
        const sy = chestY - 18 + (elbowY - (chestY - 18)) * kf;
        drawBoneSegment(ctx, sx, sy, sx + 3, sy - 9 - (k % 2) * 4, 1.5, 0.5, 95, 0.8);
      }

      const wristSwing = Math.sin(t * 1.9 - 0.8) * 6.5 + wind * 11.0 + (sp * 14 * Math.sin(t * 35));
      const wristX = elbowX + 4 + wristSwing + (isTelegraph ? 16 : 0);
      const wristY = elbowY + 68 + Math.cos(t * 1.9) * 2.5 + (isTelegraph ? -28 : 0);

      drawBoneSegment(ctx, elbowX - 2, elbowY, wristX - 2, wristY, 3.2, 2.4, 140, 0.98);
      drawBoneSegment(ctx, elbowX + 3, elbowY + 2, wristX + 3, wristY, 2.4, 2.0, 120, 0.86);

      drawSphereVolume(ctx, wristX, wristY, 4.5, 145, 0.95);
      for (let f = 0; f < 4; f++) {
        const spread = (f - 1.5) * 0.24;
        const fingerCurl = Math.sin(t * 3.4 + f * 0.9 + sp * 12) * 0.18;
        const fAngle1 = Math.PI * 0.5 + spread + fingerCurl;
        const k1x = wristX + Math.cos(fAngle1) * 11;
        const k1y = wristY + Math.sin(fAngle1) * 11;

        const fAngle2 = fAngle1 + 0.25 + fingerCurl * 1.3;
        const k2x = k1x + Math.cos(fAngle2) * 9;
        const k2y = k1y + Math.sin(fAngle2) * 9;

        drawBoneSegment(ctx, wristX + (f - 1.5) * 2, wristY + 2, k1x, k1y, 1.7, 1.3, 150, 1.0);
        drawBoneSegment(ctx, k1x, k1y, k2x, k2y, 1.2, 0.7, 150, 0.92);
      }

      // 10. Hanging Sinew & Rotting Tendons
      drawSinewStrand(ctx, chestX + 20, chestY - 8, elbowX - 4, elbowY + 12, 16, wind, 75);
      drawSinewStrand(ctx, chestX - 22, chestY + 28, pelvisX - 24, pelvisY + 6, 14, wind, 85);
      drawSinewStrand(ctx, pelvisX - 8, pelvisY + 18, kneeLX + 4, kneeLY - 8, 18, wind, 70);
      drawSinewStrand(ctx, pelvisX + 12, pelvisY + 16, kneeRX - 4, kneeRY - 6, 20, wind, 70);

      return offCanvas;
    },

    getOffscreenCanvas: function () {
      return offCanvas;
    }
  };

  window.VERMIS.Bestiary.StenchChampion = StenchChampion;
  window.VERMIS.Bestiary.STENCH_CHAMPION = StenchChampion;
})();
