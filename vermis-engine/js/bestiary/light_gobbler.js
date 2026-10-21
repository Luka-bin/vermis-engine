/**
 * VERMIS ENGINE // MODULE 04: THE BESTIARY (v1.4.1)
 * File: js/bestiary/light_gobbler.js
 * Entity: The Light Gobbler (Subterranean Lantern Eater)
 * G-Buffer Encoding:
 *   G = 65..110 (Abyssal Hide & Chitin), G = 140 (Mandible Bone),
 *   G = 215 (Swallowed Lantern Ember Core), G = 248 (Spectral Loupe Reveal Nodes)
 */
(function () {
  'use strict';

  window.VERMIS = window.VERMIS || {};
  window.VERMIS.Bestiary = window.VERMIS.Bestiary || {};

  const BUFFER_W = 320;
  const BUFFER_H = 400;

  const offCanvas = document.createElement('canvas');
  offCanvas.width = BUFFER_W;
  offCanvas.height = BUFFER_H;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

  // Siphoned light motes spiraling into the creature's gullet
  const lightMotes = Array.from({ length: 32 }, (_, i) => ({
    angle: (i / 32) * Math.PI * 2,
    dist: 20 + (i * 17) % 115,
    speed: 1.4 + (i % 5) * 0.35,
    size: 1.5 + (i % 3) * 0.9
  }));

  function drawVolumeNode(ctx, x, y, r, matID, lum) {
    if (r <= 0.5) return;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    const hi = Math.min(254, Math.round(210 * lum));
    const mid = Math.min(220, Math.round(115 * lum));
    grad.addColorStop(0.0, `rgb(${hi}, ${matID}, 200)`);
    grad.addColorStop(0.6, `rgb(${mid}, ${matID}, 110)`);
    grad.addColorStop(1.0, `rgb(10, ${matID}, 20)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLimbStrut(ctx, x1, y1, x2, y2, r1, r2, matID, lum) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const nx = -dy / len;
    const ny = dx / len;
    const cx = (x1 + x2) * 0.5;
    const cy = (y1 + y2) * 0.5;

    const grad = ctx.createLinearGradient(
      cx - nx * r1 * 1.4, cy - ny * r1 * 1.4,
      cx + nx * r1 * 1.4, cy + ny * r1 * 1.4
    );
    const hi = Math.min(250, Math.round(205 * lum));
    const mid = Math.min(210, Math.round(110 * lum));
    grad.addColorStop(0.0, `rgb(20, ${matID}, 35)`);
    grad.addColorStop(0.35, `rgb(${hi}, ${matID}, 175)`);
    grad.addColorStop(0.75, `rgb(${mid}, ${matID}, 95)`);
    grad.addColorStop(1.0, `rgb(12, ${matID}, 22)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * r1, y1 - ny * r1);
    ctx.lineTo(x2 - nx * r2, y2 - ny * r2);
    ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
    ctx.lineTo(x1 + nx * r1, y1 + ny * r1);
    ctx.closePath();
    ctx.fill();

    drawVolumeNode(ctx, x1, y1, r1 * 1.18, matID, lum * 0.9);
    drawVolumeNode(ctx, x2, y2, r2 * 1.18, matID, lum * 0.9);
  }

  const LightGobbler = {
    id: 'LIGHT_GOBBLER',
    name: 'The Light Gobbler',
    lorePlate: 'Pestilent Mines // Pitch Tunnels',
    baseStats: {
      targetNumber: 13,
      solaceDrain: 2,
      telegraphWindow: 1.5,
      complicationOnHit: 'Blindness',
      extinguishesTorch: true
    },
    spasmImpulse: 0.0,

    triggerSpasm: function (strength = 1.0) {
      this.spasmImpulse = Math.max(this.spasmImpulse, strength);
    },

    renderRig: function (targetCtx, t, dt, opts = {}) {
      const ctx = targetCtx || offCtx;
      const fsm = (opts.fsmState || opts.mode || 'DORMANT').toUpperCase();
      const bScale = typeof opts.breathScale === 'number' ? opts.breathScale : 1.0;

      if (opts.clear !== false) {
        ctx.clearRect(0, 0, BUFFER_W, BUFFER_H);
      }

      this.spasmImpulse *= Math.exp(-(dt || 0.08) * 4.2);
      const isTelegraph = fsm === 'TELEGRAPH' || fsm === 'IMPACT';
      const isAggro = fsm === 'AGGRO' || isTelegraph;

      // Pharyngeal jaw distension (opens wide during 1.5s telegraph to swallow light)
      const mawOpen = isTelegraph
        ? 0.92 + Math.sin(t * 24.0) * 0.12
        : isAggro ? 0.45 + Math.sin(t * 4.2) * 0.15 : 0.15 + Math.sin(t * 1.7) * 0.08;

      const gulletPulse = Math.sin(t * 2.6) * bScale;
      const crouchSwayX = Math.sin(t * 1.3) * 6.0;
      const crouchSwayY = Math.cos(t * 2.6) * 4.0 - (isTelegraph ? 12 : 0);

      const coreX = 160 + crouchSwayX;
      const coreY = 195 + crouchSwayY;
      const headX = coreX + Math.sin(t * 2.1) * 3.5;
      const headY = coreY - 62 + gulletPulse * 2.5;

      // 1. Siphoned Torchlight Motes (drawn into the gaping maw)
      for (let i = 0; i < lightMotes.length; i++) {
        const m = lightMotes[i];
        m.dist -= (dt || 0.08) * (isTelegraph ? 68 : 28) * m.speed;
        m.angle += (dt || 0.08) * 1.8;
        if (m.dist < 8) {
          m.dist = 115 + (i % 25);
        }
        const mx = headX + Math.cos(m.angle) * m.dist;
        const my = (headY + 12) + Math.sin(m.angle) * (m.dist * 0.65);

        // Encoded with high G=245 so the Diegetic Loupe reveals the light drain stream clearly
        ctx.fillStyle = `rgba(210, 245, 190, ${Math.min(0.65, (1.0 - m.dist / 135) * 0.6)})`;
        ctx.beginPath();
        ctx.arc(mx, my, m.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Bloated Translucent Gullet Sac (houses stolen lantern flame at G = 215)
      drawVolumeNode(ctx, coreX, coreY + 14, 52 + gulletPulse * 4.5, 55, 0.38);

      // Internal swallowed lantern core (glows rust/crimson through translucent ribs)
      const lanternFlicker = 0.78 + Math.sin(t * 17.3) * 0.18 + (isTelegraph ? 0.35 : 0);
      drawVolumeNode(ctx, coreX - 2, coreY + 18, 28 + gulletPulse * 3.0, 218, lanternFlicker);
      drawVolumeNode(ctx, coreX + 6, coreY + 10, 14, 230, lanternFlicker * 1.15);

      // Ventral rib cage gripping the luminous gullet
      for (let r = 0; r < 6; r++) {
        const ry = coreY - 18 + r * 11.5;
        const span = 44 - Math.abs(r - 2.5) * 6 + gulletPulse * 3;
        drawLimbStrut(ctx, coreX - 4, ry, coreX - span, ry + 9, 3.0, 1.6, 128, 0.82);
        drawLimbStrut(ctx, coreX + 4, ry, coreX + span, ry + 9, 3.0, 1.6, 128, 0.82);
      }

      // 3. Arachnid-Humanoid Stalking Limbs (4 elongated limbs anchored to cavern walls/floor)
      const legConfigs = [
        { side: -1, yOff: -22, kneeX: -78, kneeY: -48, footX: -108, footY: 110, phase: 0.0 },
        { side:  1, yOff: -22, kneeX:  78, kneeY: -48, footX:  108, footY: 110, phase: 1.6 },
        { side: -1, yOff:  28, kneeX: -62, kneeY:  45, footX:  -74, footY: 172, phase: 3.1 },
        { side:  1, yOff:  28, kneeX:  62, kneeY:  45, footX:   74, footY: 172, phase: 4.7 }
      ];

      for (let l = 0; l < legConfigs.length; l++) {
        const lc = legConfigs[l];
        const stepBob = Math.sin(t * 2.8 + lc.phase) * (isAggro ? 8.0 : 3.5);
        const sx = coreX + lc.side * 28;
        const sy = coreY + lc.yOff;
        const kx = coreX + lc.kneeX + lc.side * stepBob;
        const ky = coreY + lc.kneeY - Math.abs(stepBob) * 0.6 - (isTelegraph && l < 2 ? 26 : 0);
        const fx = coreX + lc.footX + (isTelegraph && l < 2 ? lc.side * 14 : 0);
        const fy = coreY + lc.footY - (isTelegraph && l < 2 ? 45 : 0);

        drawLimbStrut(ctx, sx, sy, kx, ky, 5.2, 3.8, 95, 0.85);
        drawLimbStrut(ctx, kx, ky, fx, fy, 3.6, 2.0, 130, 0.92);

        // Hooked phalanges
        drawLimbStrut(ctx, fx, fy, fx + lc.side * 12, fy + 14, 1.8, 0.7, 145, 0.95);
        drawLimbStrut(ctx, fx, fy, fx - lc.side * 6, fy + 16, 1.5, 0.6, 145, 0.85);
      }

      // 4. Split Pharyngeal Maw & Eyeless Cranium
      drawVolumeNode(ctx, headX, headY, 22, 85, 0.75);

      // Cavernous throat interior
      const jawDrop = 14 + mawOpen * 26;
      ctx.fillStyle = `rgb(8, 25, 15)`;
      ctx.beginPath();
      ctx.ellipse(headX, headY + 10 + jawDrop * 0.35, 16 + mawOpen * 8, jawDrop * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner pharyngeal lure (glows during Telegraph)
      drawVolumeNode(ctx, headX, headY + 12 + jawDrop * 0.3, 6 + mawOpen * 5, 225, isTelegraph ? 1.3 : 0.75);

      // Left & Right Split Mandibles
      const mandSpread = 12 + mawOpen * 18;
      drawLimbStrut(ctx, headX - 10, headY + 2, headX - mandSpread, headY + jawDrop, 4.2, 2.0, 142, 0.96);
      drawLimbStrut(ctx, headX + 10, headY + 2, headX + mandSpread, headY + jawDrop, 4.2, 2.0, 142, 0.96);

      // Needle teeth lining the split mandibles
      ctx.fillStyle = `rgb(225, 148, 210)`;
      for (let n = 0; n < 5; n++) {
        const nf = n / 4;
        const lx = (headX - 10) + (-mandSpread + 10) * nf;
        const rx = (headX + 10) + (mandSpread - 10) * nf;
        const ty = headY + 4 + jawDrop * nf;
        ctx.fillRect(lx, ty, 3.2, 1.4);
        ctx.fillRect(rx - 3.2, ty, 3.2, 1.4);
      }

      // 5. Spectral Loupe Weak-Point Eyes (Material G = 248 -> Revealed by #loupe-canvas X-Ray Pass)
      for (let e = 0; e < 6; e++) {
        const ang = -Math.PI * 0.85 + (e / 5) * Math.PI * 0.7;
        const ex = headX + Math.cos(ang) * 26;
        const ey = headY - 6 + Math.sin(ang) * 18;
        ctx.fillStyle = `rgb(32, 248, 220)`;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.8, 0, Math.PI * 2);
        ctx.fill();
      }

      return offCanvas;
    },

    getOffscreenCanvas: function () {
      return offCanvas;
    }
  };

  window.VERMIS.Bestiary.LightGobbler = LightGobbler;
  window.VERMIS.Bestiary.LIGHT_GOBBLER = LightGobbler;
})();
