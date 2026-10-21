/**
 * VERMIS ENGINE // MODULE 04: THE BESTIARY (v1.4.1)
 * File: js/bestiary/marionette.js
 * Entity: The Pale Swordsman Marionette ("The Puppet Without Strings")
 * G-Buffer Encoding:
 *   G = 155 (Cracked Porcelain Armor & Mask), G = 80 (Hollow Joint Sockets),
 *   G = 222 (Rusted Rapier & Blood Weep), G = 246 (Unseen Celestial Puppet Threads)
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

  function drawPorcelainSegment(ctx, x1, y1, x2, y2, r1, r2, matID, lum) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    const nx = -dy / len;
    const ny = dx / len;
    const cx = (x1 + x2) * 0.5;
    const cy = (y1 + y2) * 0.5;
    const maxR = Math.max(r1, r2) * 1.25;

    const grad = ctx.createLinearGradient(
      cx - nx * maxR, cy - ny * maxR,
      cx + nx * maxR, cy + ny * maxR
    );
    const hi = Math.min(254, Math.round(235 * lum));
    const mid = Math.min(225, Math.round(150 * lum));
    grad.addColorStop(0.0, `rgb(24, ${matID}, 45)`);
    grad.addColorStop(0.28, `rgb(${hi}, ${matID}, 215)`);
    grad.addColorStop(0.72, `rgb(${mid}, ${matID}, 130)`);
    grad.addColorStop(1.0, `rgb(14, ${matID}, 25)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x1 - nx * r1, y1 - ny * r1);
    ctx.lineTo(x2 - nx * r2, y2 - ny * r2);
    ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
    ctx.lineTo(x1 + nx * r1, y1 + ny * r1);
    ctx.closePath();
    ctx.fill();

    // Dark exposed wooden/iron doll ball-joints at ends
    ctx.fillStyle = `rgb(22, 75, 40)`;
    ctx.beginPath();
    ctx.arc(x1, y1, r1 * 0.95, 0, Math.PI * 2);
    ctx.arc(x2, y2, r2 * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPuppetMask(ctx, x, y, tilt, matID, lum) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // Oval porcelain face plate
    const grad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 17);
    grad.addColorStop(0.0, `rgb(${Math.min(254, Math.round(242 * lum))}, ${matID}, 225)`);
    grad.addColorStop(0.65, `rgb(${Math.round(165 * lum)}, ${matID}, 140)`);
    grad.addColorStop(1.0, `rgb(20, ${matID}, 35)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13.5, 17.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vertical hairline fracture down the left eye
    ctx.strokeStyle = `rgb(15, 40, 20)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, -15);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-7, 6);
    ctx.lineTo(-3, 15);
    ctx.stroke();

    // Hollow porcelain eye slits
    ctx.fillStyle = `rgb(8, 25, 12)`;
    ctx.beginPath();
    ctx.ellipse(-5, -2, 3.4, 1.8, 0.1, 0, Math.PI * 2);
    ctx.ellipse(5, -2, 3.4, 1.8, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Crimson rust tear weeping from cracked socket (G = 220)
    ctx.fillStyle = `rgb(165, 220, 140)`;
    ctx.fillRect(-5.8, 0, 1.8, 12);

    // Ventriloquist split jaw seam
    ctx.strokeStyle = `rgb(12, 30, 15)`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-4.5, 8);
    ctx.lineTo(4.5, 8);
    ctx.moveTo(-4, 8);
    ctx.lineTo(-4, 16);
    ctx.moveTo(4, 8);
    ctx.lineTo(4, 16);
    ctx.stroke();

    ctx.restore();
  }

  const PaleMarionette = {
    id: 'MARIONETTE',
    name: 'Pale Swordsman Marionette',
    lorePlate: 'The Puppet Without Strings',
    baseStats: {
      targetNumber: 15,
      solaceDrain: 2,
      telegraphWindow: 1.5,
      complicationOnHit: 'Shattered Ribs',
      parryStance: true
    },
    spasmImpulse: 0.0,

    triggerSpasm: function (strength = 1.2) {
      this.spasmImpulse = Math.max(this.spasmImpulse, strength);
    },

    renderRig: function (targetCtx, t, dt, opts = {}) {
      const ctx = targetCtx || offCtx;
      const fsm = (opts.fsmState || opts.mode || 'DORMANT').toUpperCase();
      const wind = typeof opts.wind === 'number' ? opts.wind : -0.2;

      if (opts.clear !== false) {
        ctx.clearRect(0, 0, BUFFER_W, BUFFER_H);
      }

      this.spasmImpulse *= Math.exp(-(dt || 0.08) * 5.0);
      const isTelegraph = fsm === 'TELEGRAPH' || fsm === 'IMPACT';

      // Quantized mechanical jerk (snaps between angular keyframes like a clockwork doll)
      const quantizedTick = Math.floor(t * 4.0) / 4.0;
      const snapJerk = Math.sin(quantizedTick * 7.5) * 0.12 + this.spasmImpulse * Math.sin(t * 38) * 0.25;

      // Pendulum suspension sway from unseen rafters
      const pendulumAngle = Math.sin(t * 1.45) * 0.07 + wind * 0.08;
      const pivotX = 160;
      const pivotY = 10;

      const chestX = pivotX + Math.sin(pendulumAngle) * 125;
      const chestY = pivotY + Math.cos(pendulumAngle) * 125 + Math.abs(Math.sin(t * 2.9)) * 4;

      const pelvisX = chestX - Math.sin(pendulumAngle * 1.4) * 18;
      const pelvisY = chestY + 74;

      // 1. Unseen Overhead Puppet Strings (G = 246 -> Faint normally, blazing under Diegetic Loupe)
      const threadTargets = [
        { x: chestX, y: chestY - 40 },
        { x: chestX - 32, y: chestY - 12 },
        { x: chestX + 32, y: chestY - 12 },
        { x: chestX + 64, y: chestY + (isTelegraph ? -48 : 28) }
      ];
      ctx.strokeStyle = `rgba(38, 246, 210, 0.42)`;
      ctx.lineWidth = 1.1;
      for (let i = 0; i < threadTargets.length; i++) {
        const tt = threadTargets[i];
        ctx.beginPath();
        ctx.moveTo(tt.x + wind * 14, 4);
        ctx.lineTo(tt.x, tt.y);
        ctx.stroke();
      }

      // 2. Dangling Broken-Ankle Doll Legs (tiptoe hovering slightly above stone floor)
      const kneeLX = pelvisX - 18 + Math.sin(t * 1.45 - 0.6) * 8;
      const kneeLY = pelvisY + 66;
      const ankleLX = kneeLX - 6 + wind * 10;
      const ankleLY = kneeLY + 64;

      const kneeRX = pelvisX + 18 + Math.sin(t * 1.45 - 0.2) * 8;
      const kneeRY = pelvisY + 64;
      const ankleRX = kneeRX + 8 + wind * 10;
      const ankleRY = kneeRY + 66;

      drawPorcelainSegment(ctx, pelvisX - 12, pelvisY, kneeLX, kneeLY, 5.5, 4.0, 152, 0.9);
      drawPorcelainSegment(ctx, kneeLX, kneeLY, ankleLX, ankleLY, 3.8, 2.4, 152, 0.85);
      // Pointed porcelain sabaton hanging limp
      drawPorcelainSegment(ctx, ankleLX, ankleLY, ankleLX - 4, ankleLY + 18, 2.4, 1.0, 158, 0.8);

      drawPorcelainSegment(ctx, pelvisX + 12, pelvisY, kneeRX, kneeRY, 5.5, 4.0, 152, 0.92);
      drawPorcelainSegment(ctx, kneeRX, kneeRY, ankleRX, ankleRY, 3.8, 2.4, 152, 0.88);
      drawPorcelainSegment(ctx, ankleRX, ankleRY, ankleRX + 4, ankleRY + 18, 2.4, 1.0, 158, 0.84);

      // 3. Corseted Porcelain Torso & Articulated Waist Ball-Joint
      drawPorcelainSegment(ctx, chestX, chestY - 22, pelvisX, pelvisY, 18.0, 11.5, 155, 0.96);

      // Exposed hollow rib slots in porcelain cuirass
      ctx.fillStyle = `rgb(10, 35, 18)`;
      for (let s = 0; s < 4; s++) {
        const sy = chestY - 10 + s * 11;
        ctx.fillRect(chestX - 11, sy, 8, 3.5);
        ctx.fillRect(chestX + 3, sy, 8, 3.5);
      }

      // 4. Left Arm (Limp Counter-Weight Arm with Severed Wrist Tendons)
      const shLX = chestX - 24;
      const shLY = chestY - 16;
      const elbLX = shLX - 18 + Math.sin(t * 1.8) * 6;
      const elbLY = shLY + 44;
      const wrLX = elbLX - 8 + wind * 14;
      const wrLY = elbLY + 46;

      drawPorcelainSegment(ctx, shLX, shLY, elbLX, elbLY, 4.5, 3.4, 150, 0.88);
      drawPorcelainSegment(ctx, elbLX, elbLY, wrLX, wrLY, 3.2, 2.2, 150, 0.84);

      // 5. Right Sword Arm & Rusted Rapier (Snaps to high overhead en-garde during 1.5s TELEGRAPH)
      const shRX = chestX + 24;
      const shRY = chestY - 16;
      const elbRX = isTelegraph
        ? shRX + 28 + snapJerk * 12
        : shRX + 24 + Math.cos(t * 1.5) * 4;
      const elbRY = isTelegraph
        ? shRY - 28
        : shRY + 32;

      const wrRX = isTelegraph
        ? elbRX + 18
        : elbRX + 26 + snapJerk * 18;
      const wrRY = isTelegraph
        ? elbRY - 34
        : elbRY + 14;

      drawPorcelainSegment(ctx, shRX, shRY, elbRX, elbRY, 4.8, 3.6, 156, 0.96);
      drawPorcelainSegment(ctx, elbRX, elbRY, wrRX, wrRY, 3.5, 2.5, 156, 0.98);

      // Cup-Hilt Rapier (G = 222 Rust/Crimson Iron)
      const bladeAngle = isTelegraph
        ? -Math.PI * 0.82 + snapJerk * 0.3
        : -Math.PI * 0.18 + snapJerk * 0.25;
      const bladeLen = 96;
      const tipX = wrRX + Math.cos(bladeAngle) * bladeLen;
      const tipY = wrRY + Math.sin(bladeAngle) * bladeLen;

      // Rapier bell guard
      ctx.fillStyle = `rgb(195, 222, 180)`;
      ctx.beginPath();
      ctx.arc(wrRX, wrRY, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Needle rapier blade
      drawPorcelainSegment(ctx, wrRX, wrRY, tipX, tipY, 2.2, 0.6, 224, isTelegraph ? 1.25 : 1.05);

      // 6. Dislocated Porcelain Mask Head (Snaps 40 degrees sideways when telegraphing)
      const headTilt = (isTelegraph ? -0.58 : 0.34) + snapJerk * 0.85;
      drawPorcelainSegment(ctx, chestX, chestY - 22, chestX + Math.sin(headTilt) * 6, chestY - 38, 4.2, 3.5, 145, 0.85);
      drawPuppetMask(ctx, chestX + Math.sin(headTilt) * 10, chestY - 50, headTilt, 158, 1.02);

      return offCanvas;
    },

    getOffscreenCanvas: function () {
      return offCanvas;
    }
  };

  window.VERMIS.Bestiary.PaleMarionette = PaleMarionette;
  window.VERMIS.Bestiary.MARIONETTE = PaleMarionette;
})();
