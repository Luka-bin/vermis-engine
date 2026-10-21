/**
 * VERMIS ENGINE // MODULE 02.1 & 03.1: BOUNDED LOUPE & PAPER-DOLL AABB DRAGGER [v1.5.2]
 * File: js/ui/ui-dragger.js (Dual-path compatible with js/ui-dragger.js)
 * Purpose: Unified HTML5 Pointer Events API, #raycast-view Bounded Diegetic Loupe,
 *          .corrupt-cipher Decrypter, and AABB Paper-Doll Spatial Inventory Math.
 */
(function () {
  'use strict';

  var V = (window.VERMIS = window.VERMIS || {});

  var CORRUPT_GLYPHS = '¥§¤‡†¶ØÆÐÞß÷×¿¡░▒▓█▄▀■';

  var RELIC_CATALOG = {
    rusted_cleaver: {
      id: 'rusted_cleaver',
      name: 'Rusted Broad-Cleaver',
      slotType: 'hand',
      weight: 2,
      weaponAV: 2,
      armorAV: 0,
      lore: 'A notched iron blade dredged from the Catacombs ossuary. (+2 MELEE AV, WT: 2)'
    },
    miner_lantern: {
      id: 'miner_lantern',
      name: 'Tallow Miner Lantern',
      slotType: 'hand',
      weight: 1,
      weaponAV: 0,
      armorAV: 0,
      statBonus: { wits: 1 },
      lore: 'Casts a sickly yellow cone through Rot Tier fog. (+1 WITS, WT: 1)'
    },
    corroded_hauberk: {
      id: 'corroded_hauberk',
      name: 'Corroded Chain Hauberk',
      slotType: 'torso',
      weight: 3,
      weaponAV: 0,
      armorAV: 2,
      lore: 'Fused links of verdigris iron. Absorbs cleaver blows. (+2 DEFENSE AV, WT: 3)'
    },
    moss_salve: {
      id: 'moss_salve',
      name: 'Putrid Moss Salve',
      slotType: 'pouch',
      weight: 1,
      consumable: true,
      buff: { id: 'buff_moss_salve', name: 'Moss Salve', stat: 'brawn', flatBonus: 2, duration: 25 },
      lore: 'Numbs nerve endings and coagulates open wounds. (+2 BRAWN for 25s, WT: 1)'
    }
  };

  function UnifiedUIDragger() {
    this.loupeContainer =
      document.getElementById('loupe-inset') ||
      document.getElementById('loupeContainer');
    this.loupeCanvas =
      document.getElementById('loupe-canvas') ||
      document.getElementById('loupeCanvas');
    this.stageCanvas =
      document.getElementById('visual-stage-canvas') ||
      document.getElementById('displayCanvas');
    this.raycastView = document.getElementById('raycast-view');
    this.screenFrame = document.getElementById('screen');

    this.isDraggingLoupe = false;
    this.loupePointerId = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.screenX = 140;
    this.screenY = 180;

    this.activeDragItem = null;
    this.inspectedItemId = 'rusted_cleaver';
    this.zoneSlots = {
      head:  { capacity: 2, used: 0, items: [] },
      torso: { capacity: 4, used: 0, items: [] },
      hand:  { capacity: 3, used: 0, items: [] },
      pouch: { capacity: 3, used: 0, items: [] }
    };

    this._ensureCaptionBadge();
    this._bindLoupePointerEvents();
    this._bindPaperDollInventory();
    this._startSquirmingCipherLoop();
  }

  UnifiedUIDragger.prototype._ensureCaptionBadge = function () {
    if (!this.loupeContainer) return;
    this.loupeContainer.style.pointerEvents = 'auto';
    this.loupeContainer.style.cursor = 'grab';
    this.loupeContainer.style.touchAction = 'none';

    var badge = document.getElementById('loupe-cipher-readout');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'loupe-cipher-readout';
      badge.style.cssText = [
        'position:absolute',
        'bottom:6px',
        'left:6px',
        'right:6px',
        'background:#000',
        'color:#a8ffb2',
        'border:1px solid #ff003c',
        'font-family:"Courier New",monospace',
        'font-size:9px',
        'line-height:1.15',
        'padding:2px 4px',
        'text-align:center',
        'text-transform:uppercase',
        'pointer-events:none',
        'display:none'
      ].join(';');
      this.loupeContainer.appendChild(badge);
    }
    this.cipherBadge = badge;
  };

  // ==========================================================================
  // 1. DIEGETIC LOUPE POINTER DRAGGING (STRICTLY CLAMPED TO #raycast-view)
  // ==========================================================================
  UnifiedUIDragger.prototype._bindLoupePointerEvents = function () {
    var self = this;
    if (!this.loupeContainer) return;

    this.loupeContainer.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.isDraggingLoupe = true;
      self.loupePointerId = e.pointerId;
      self.loupeContainer.classList.add('dragging');
      self.loupeContainer.style.cursor = 'grabbing';

      if (self.loupeContainer.setPointerCapture) {
        try { self.loupeContainer.setPointerCapture(e.pointerId); } catch (_) {}
      }

      var rect = self.loupeContainer.getBoundingClientRect();
      self.dragOffsetX = e.clientX - (rect.left + rect.width * 0.5);
      self.dragOffsetY = e.clientY - (rect.top + rect.height * 0.5);
    });

    window.addEventListener('pointermove', function (e) {
      var fKeyHeld =
        V.inputMap &&
        (typeof V.inputMap.isActionActive === 'function'
          ? V.inputMap.isActionActive('ACTION_LOUPE')
          : Boolean(V.inputMap.ACTION_LOUPE));

      if (self.isDraggingLoupe || fKeyHeld) {
        var cx = e.clientX - (self.isDraggingLoupe ? self.dragOffsetX : 0);
        var cy = e.clientY - (self.isDraggingLoupe ? self.dragOffsetY : 0);
        self.setLoupeScreenPosition(cx, cy);
      }
    });

    var endLoupeDrag = function () {
      if (!self.isDraggingLoupe) return;
      self.isDraggingLoupe = false;
      self.loupeContainer.classList.remove('dragging');
      self.loupeContainer.style.cursor = 'grab';
      if (self.loupePointerId !== null && self.loupeContainer.releasePointerCapture) {
        try { self.loupeContainer.releasePointerCapture(self.loupePointerId); } catch (_) {}
      }
      self.loupePointerId = null;
    };

    window.addEventListener('pointerup', endLoupeDrag);
    window.addEventListener('pointercancel', endLoupeDrag);
  };

  /**
   * Clamps #loupe-inset strictly inside the bounding box of #raycast-view
   * so it can never be dragged down onto the 2DS controller deck (#mobile-touch-deck).
   */
  UnifiedUIDragger.prototype.setLoupeScreenPosition = function (clientX, clientY) {
    if (!this.loupeContainer) return;

    var boundaryEl =
      document.getElementById('raycast-view') ||
      this.raycastView ||
      this.stageCanvas ||
      this.screenFrame ||
      document.body;

    var boundRect = boundaryEl.getBoundingClientRect();
    if (boundRect.width === 0 || boundRect.height === 0) return;

    var offsetParent = this.loupeContainer.offsetParent || document.body;
    var parentRect = offsetParent.getBoundingClientRect();

    var w = this.loupeContainer.offsetWidth || 100;
    var h = this.loupeContainer.offsetHeight || 100;

    // Clamp top-left screen coordinates strictly within #raycast-view bounds
    var minScreenLeft = boundRect.left + 4;
    var maxScreenLeft = Math.max(minScreenLeft, boundRect.right - w - 4);
    var minScreenTop = boundRect.top + 4;
    var maxScreenTop = Math.max(minScreenTop, boundRect.bottom - h - 4);

    var targetScreenLeft = clientX - w * 0.5;
    var targetScreenTop = clientY - h * 0.5;

    var clampedScreenLeft = Math.max(minScreenLeft, Math.min(maxScreenLeft, targetScreenLeft));
    var clampedScreenTop = Math.max(minScreenTop, Math.min(maxScreenTop, targetScreenTop));

    // Convert clamped screen coordinates into offsetParent local coordinates
    var localLeft = Math.round(clampedScreenLeft - parentRect.left);
    var localTop = Math.round(clampedScreenTop - parentRect.top);

    this.loupeContainer.style.left = localLeft + 'px';
    this.loupeContainer.style.top = localTop + 'px';
    this.loupeContainer.style.bottom = 'auto';
    this.loupeContainer.style.right = 'auto';

    this.screenX = clampedScreenLeft + w * 0.5;
    this.screenY = clampedScreenTop + h * 0.5;

    this._refreshLoupeInspection();
  };

  UnifiedUIDragger.prototype.nudgeLoupeByStick = function (dx, dy) {
    if (!this.loupeContainer) return;
    var rect = this.loupeContainer.getBoundingClientRect();
    this.setLoupeScreenPosition(
      rect.left + rect.width * 0.5 + dx,
      rect.top + rect.height * 0.5 + dy
    );
  };

  UnifiedUIDragger.prototype._refreshLoupeInspection = function () {
    var ciphers = document.querySelectorAll('.corrupt-cipher');
    var foundCipher = null;

    for (var i = 0; i < ciphers.length; i++) {
      var span = ciphers[i];
      var r = span.getBoundingClientRect();
      var cx = r.left + r.width * 0.5;
      var cy = r.top + r.height * 0.5;
      if (Math.hypot(this.screenX - cx, this.screenY - cy) < 68) {
        foundCipher =
          span.getAttribute('data-decrypted') ||
          span.getAttribute('title') ||
          'DECIPHERED SIGIL';
        span.setAttribute('data-revealed', 'true');
        span.textContent = foundCipher;
      } else {
        span.removeAttribute('data-revealed');
      }
    }

    if (this.cipherBadge) {
      if (foundCipher) {
        this.cipherBadge.hidden = false;
        this.cipherBadge.style.display = 'block';
        this.cipherBadge.textContent = 'DECRYPTED: ' + foundCipher;
      } else {
        this.cipherBadge.hidden = true;
        this.cipherBadge.style.display = 'none';
      }
    }

    if (this.stageCanvas) {
      var sRect = this.stageCanvas.getBoundingClientRect();
      if (sRect.width > 0 && sRect.height > 0) {
        var normX = Math.max(0, Math.min(1, (this.screenX - sRect.left) / sRect.width));
        var normY = Math.max(0, Math.min(1, (this.screenY - sRect.top) / sRect.height));
        var stageX = Math.round(normX * 320);
        var stageY = Math.round(normY * 400);

        var coordLabel = document.getElementById('loupe-coord-label');
        if (coordLabel) {
          coordLabel.textContent = 'X:' + stageX + ' Y:' + stageY;
        }

        if (V.Shader && typeof V.Shader.renderLoupePass === 'function') {
          V.Shader.renderLoupePass(stageX, stageY);
        }
      }
    }
  };

  // ==========================================================================
  // 2. PAPER-DOLL SPATIAL INVENTORY & AABB WEIGHT CAPACITY MATH
  // ==========================================================================
  UnifiedUIDragger.prototype._bindPaperDollInventory = function () {
    var self = this;

    var bindItems = function () {
      var chips = document.querySelectorAll('.paper-doll-item');
      for (var i = 0; i < chips.length; i++) {
        (function (chip) {
          if (chip.dataset.vermisDragBound === 'true') return;
          chip.dataset.vermisDragBound = 'true';
          chip.style.touchAction = 'none';

          chip.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            var itemId = chip.dataset.itemId || 'rusted_cleaver';
            self.selectInspectedItem(itemId);

            var catEntry = RELIC_CATALOG[itemId];
            self.activeDragItem = {
              el: chip,
              itemId: itemId,
              weight: Number(chip.dataset.weight || (catEntry && catEntry.weight) || 1),
              startX: e.clientX,
              startY: e.clientY
            };

            chip.style.position = 'relative';
            chip.style.zIndex = '999';
            if (chip.setPointerCapture) {
              try { chip.setPointerCapture(e.pointerId); } catch (_) {}
            }
          });

          chip.addEventListener('pointermove', function (e) {
            if (!self.activeDragItem || self.activeDragItem.el !== chip) return;
            var dx = e.clientX - self.activeDragItem.startX;
            var dy = e.clientY - self.activeDragItem.startY;
            chip.style.transform =
              'translate(' + Math.round(dx) + 'px, ' + Math.round(dy) + 'px)';
          });

          var finishItemDrop = function () {
            if (!self.activeDragItem || self.activeDragItem.el !== chip) return;
            var dragRect = chip.getBoundingClientRect();
            chip.style.transform = '';
            chip.style.zIndex = '';

            self._evaluateAABBDropZones(dragRect, self.activeDragItem);
            self.activeDragItem = null;
          };

          chip.addEventListener('pointerup', finishItemDrop);
          chip.addEventListener('pointercancel', finishItemDrop);
        })(chips[i]);
      }
    };

    bindItems();
    window.addEventListener('VermisModalOpened', function (e) {
      if (e.detail && e.detail.modalId === 'modal-inventory') {
        bindItems();
      }
    });

    var bindBtn =
      V.bindAction ||
      function (sel, ev, fn) {
        var el = document.querySelector(sel);
        if (el) el.addEventListener(ev, fn);
      };

    bindBtn('#btn-bind-item-q', 'click', function () {
      self.bindInspectedToHotkey('Q');
    });
    bindBtn('#btn-bind-item-e', 'click', function () {
      self.bindInspectedToHotkey('E');
    });
    bindBtn('#btn-use-inspect-item', 'click', function () {
      self.useInspectedItem();
    });
  };

  UnifiedUIDragger.prototype._evaluateAABBDropZones = function (itemRect, dragData) {
    var dropZones = document.querySelectorAll(
      '#vessel-wireframe .equip-slot, .equip-slot[data-zone]'
    );
    for (var i = 0; i < dropZones.length; i++) {
      var zoneEl = dropZones[i];
      var zRect = zoneEl.getBoundingClientRect();

      var intersects = !(
        itemRect.right < zRect.left ||
        itemRect.left > zRect.right ||
        itemRect.bottom < zRect.top ||
        itemRect.top > zRect.bottom
      );

      if (intersects) {
        var zoneKey = zoneEl.dataset.zone || 'hand';
        var zSlot = this.zoneSlots[zoneKey];
        var zoneCapacity = Number(zoneEl.dataset.capacity || (zSlot && zSlot.capacity) || 4);
        var currentUsedSlots = Number(zoneEl.dataset.used || (zSlot && zSlot.used) || 0);
        var itemWeight = dragData.weight;

        if (zoneCapacity - currentUsedSlots >= itemWeight) {
          var nextUsed = currentUsedSlots + itemWeight;
          zoneEl.dataset.used = String(nextUsed);
          if (zSlot) {
            zSlot.used = nextUsed;
            zSlot.items.push(dragData.itemId);
          }

          zoneEl.appendChild(dragData.el);
          var capBadge = zoneEl.querySelector('.slot-cap');
          if (capBadge) {
            capBadge.textContent = '[CAP: ' + nextUsed + '/' + zoneCapacity + ']';
          }

          this._recomputeEquippedGearModifiers();
          if (V.UI && V.UI.logTelemetry) {
            V.UI.logTelemetry(
              'EQUIPPED [' +
                dragData.itemId.toUpperCase() +
                '] TO ' +
                zoneKey.toUpperCase() +
                ' (' +
                nextUsed +
                '/' +
                zoneCapacity +
                ' WT).'
            );
          }
        } else if (V.UI && V.UI.logTelemetry) {
          V.UI.logTelemetry(
            'CAPACITY EXCEEDED // ' +
              zoneKey.toUpperCase() +
              ' REQUIRES ' +
              itemWeight +
              ' SLOTS (' +
              (zoneCapacity - currentUsedSlots) +
              ' FREE).',
            true
          );
        }
        return;
      }
    }
  };

  UnifiedUIDragger.prototype._recomputeEquippedGearModifiers = function () {
    var weaponAV = 1;
    var armorAV = 0;
    var witsBonus = 0;

    var keys = Object.keys(this.zoneSlots);
    for (var i = 0; i < keys.length; i++) {
      var z = this.zoneSlots[keys[i]];
      for (var j = 0; j < z.items.length; j++) {
        var relic = RELIC_CATALOG[z.items[j]];
        if (!relic) continue;
        weaponAV += relic.weaponAV || 0;
        armorAV += relic.armorAV || 0;
        if (relic.statBonus && relic.statBonus.wits) witsBonus += relic.statBonus.wits;
      }
    }

    if (V.Character && typeof V.Character.setGearModifiers === 'function') {
      V.Character.setGearModifiers({ weaponAV: weaponAV, armorAV: armorAV, wits: witsBonus });
    }
  };

  UnifiedUIDragger.prototype.selectInspectedItem = function (itemId) {
    this.inspectedItemId = itemId;
    var relic = RELIC_CATALOG[itemId] || RELIC_CATALOG.rusted_cleaver;
    var titleEl = document.getElementById('guide-inspector-title');
    var statsEl = document.getElementById('guide-inspector-stats');
    var loreEl = document.getElementById('guide-inspector-lore');

    if (titleEl) titleEl.textContent = relic.name.toUpperCase();
    if (statsEl) {
      statsEl.textContent =
        'SLOT: ' + relic.slotType.toUpperCase() + ' // WEIGHT: ' + relic.weight;
    }
    if (loreEl) loreEl.textContent = relic.lore;
  };

  UnifiedUIDragger.prototype.bindInspectedToHotkey = function (slotKey) {
    var relic = RELIC_CATALOG[this.inspectedItemId] || RELIC_CATALOG.moss_salve;
    if (V.inputMap && typeof V.inputMap.bindHotkey === 'function') {
      V.inputMap.bindHotkey(slotKey, {
        id: relic.id,
        name: relic.name,
        execute: function () {
          if (relic.buff && V.Character && typeof V.Character.applyBuff === 'function') {
            V.Character.applyBuff(relic.buff);
          }
        }
      });
    } else {
      V.hotkeys = V.hotkeys || {};
      V.hotkeys[slotKey] = { id: relic.id, name: relic.name };
    }

    if (V.UI && V.UI.logTelemetry) {
      V.UI.logTelemetry(
        'BOUND [' + relic.name.toUpperCase() + '] TO HOTKEY [' + slotKey + '].'
      );
    }
  };

  UnifiedUIDragger.prototype.useInspectedItem = function () {
    var relic = RELIC_CATALOG[this.inspectedItemId] || RELIC_CATALOG.moss_salve;
    if (relic.buff && V.Character && typeof V.Character.applyBuff === 'function') {
      V.Character.applyBuff(relic.buff);
    } else if (V.UI && V.UI.logTelemetry) {
      V.UI.logTelemetry(
        'INSPECTED RELIC: [' + relic.name.toUpperCase() + '] — ' + relic.lore
      );
    }
  };

  UnifiedUIDragger.prototype._startSquirmingCipherLoop = function () {
    setInterval(function () {
      var ciphers = document.querySelectorAll('.corrupt-cipher:not([data-revealed="true"])');
      for (var c = 0; c < ciphers.length; c++) {
        var span = ciphers[c];
        var trueText = span.getAttribute('data-decrypted') || 'UNKNOWN ROT';
        var garbled = '';
        for (var i = 0; i < trueText.length; i++) {
          if (trueText[i] === ' ') {
            garbled += ' ';
          } else if (Math.random() < 0.35) {
            garbled += CORRUPT_GLYPHS[Math.floor(Math.random() * CORRUPT_GLYPHS.length)];
          } else {
            garbled += trueText[i];
          }
        }
        span.textContent = garbled;
      }
    }, 140);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      V.UIDragger = new UnifiedUIDragger();
    });
  } else {
    V.UIDragger = new UnifiedUIDragger();
  }
})();

