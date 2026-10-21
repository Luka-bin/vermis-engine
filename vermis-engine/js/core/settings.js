/* ============================================================================
   VERMIS // MODULE 00: DIFFICULTY SCALING, WALKTHROUGH & CALIBRATION
   File: js/core/settings.js
   Target Version: v1.5.2 (Strict ES5 / Mobile-Safe / Zero Inline HTML)
   Implements: UNFORGIVING (1.0x), MISERABLE (1.5x), DOOMED (2.0x),
               Setup Walkthrough Wizard, Multi-Pane Preferences Hooks,
               Plate/CRT/FPS Calibration, & Strict Gyro Sensor Lock
   ============================================================================ */

window.VERMIS = window.VERMIS || {};

(function () {
  'use strict';

  var V = window.VERMIS;

  // Baseline Configuration (Safe initialization regardless of script load order)
  V.Config = V.Config || {};
  var defaultConfig = {
    fps: 12,
    palette: 'catacombs',
    crtEnabled: true,
    loupeEnabled: false,
    gyroEnabled: false, // Strictly locked OFF by default per MS-DOS specification
    gyroLocked: true,
    touchDeckEnabled: true,
    controlScheme: 'dpad',
    padEditMode: false,
    brightness: 100,
    contrast: 100,
    gamma: 100,
    difficulty: 'UNFORGIVING',
    difficultyMultiplier: 1.0,
    rotSpreadMultiplier: 1.0,
    solaceRecoveryRestricted: false
  };

  for (var cfgKey in defaultConfig) {
    if (Object.prototype.hasOwnProperty.call(defaultConfig, cfgKey)) {
      if (typeof V.Config[cfgKey] === 'undefined') {
        V.Config[cfgKey] = defaultConfig[cfgKey];
      }
    }
  }

  // Unified Debounced Pointer/Click Binder (ES5 Mobile Sandbox Safe)
  if (typeof V.bindAction !== 'function') {
    V.bindAction = function (selectorOrElements, eventType, callback) {
      var lastFired = 0;
      var handler = function (e) {
        var now = Date.now();
        if (now - lastFired < 260) return;
        lastFired = now;
        if (e && typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        callback(e);
      };

      var elements = [];
      if (typeof selectorOrElements === 'string') {
        var nodeList = document.querySelectorAll(selectorOrElements);
        for (var i = 0; i < nodeList.length; i++) {
          elements.push(nodeList[i]);
        }
      } else if (selectorOrElements && selectorOrElements.nodeType === 1) {
        elements.push(selectorOrElements);
      } else if (selectorOrElements && typeof selectorOrElements.length === 'number') {
        for (var j = 0; j < selectorOrElements.length; j++) {
          elements.push(selectorOrElements[j]);
        }
      }

      for (var k = 0; k < elements.length; k++) {
        var el = elements[k];
        if (!el) continue;
        var attrName = 'data-vermis-bound-' + eventType;
        if (el.getAttribute(attrName) === 'true') continue;
        el.setAttribute(attrName, 'true');
        el.addEventListener(eventType, handler, false);
        if (eventType === 'click') {
          el.addEventListener('pointerup', handler, false);
        }
      }
    };
  }

  // Safe CustomEvent dispatcher for older mobile WebViews
  function dispatchVermisEvent(eventName, detailObj) {
    try {
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent(eventName, { detail: detailObj || {} }));
      } else {
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(eventName, false, false, detailObj || {});
        window.dispatchEvent(evt);
      }
    } catch (e) {
      // Ignore event errors in restricted WebViews
    }
  }

  var DIFFICULTY_TIERS = {
    UNFORGIVING: {
      id: 'UNFORGIVING',
      label: 'UNFORGIVING (1.0x)',
      statMultiplier: 1.0,
      rotSpreadMultiplier: 1.0,
      startingBonusBP: 0,
      solaceRecoveryRestricted: false,
      description: 'Baseline survival horror. 1.0x enemy Target Numbers and standard Rot Tier progression.'
    },
    MISERABLE: {
      id: 'MISERABLE',
      label: 'MISERABLE (1.5x)',
      statMultiplier: 1.5,
      rotSpreadMultiplier: 1.35,
      startingBonusBP: 0,
      solaceRecoveryRestricted: false,
      description: '1.5x enemy stats and accelerated Miasma Rot Tier degradation across corridors.'
    },
    DOOMED: {
      id: 'DOOMED',
      label: 'DOOMED (2.0x)',
      statMultiplier: 2.0,
      rotSpreadMultiplier: 1.75,
      startingBonusBP: 0,
      solaceRecoveryRestricted: true,
      description: '2.0x enemy stats, rapid Rot Tier 4 encroachment, and restricted Solace recovery at Anchor Rooms.'
    }
  };

  var PALETTE_ORDER = ['catacombs', 'flutewoods', 'brutalist'];
  var FPS_ORDER = [12, 24, 60];

  V.Settings = {
    isInitialized: false,
    isWalkthroughMode: false,
    tiers: DIFFICULTY_TIERS,

    initialize: function () {
      if (this.isInitialized) return;
      this.isInitialized = true;

      this.bindModalTriggers();
      this.setDifficulty(V.Config.difficulty || 'UNFORGIVING');
      this.applyPalette(V.Config.palette || 'catacombs');
      this.applyCRT(V.Config.crtEnabled !== false);
      this.applyFPS(V.Config.fps || 12);
      this.enforceGyroLock();
    },

    // Launched when player clicks [1] NEW GAME
    startSetupWalkthrough: function () {
      this.isWalkthroughMode = true;
      var titleEl = document.getElementById('prefs-modal-title');
      var confirmBtn = document.getElementById('btn-confirm-preferences');

      if (titleEl) {
        titleEl.textContent = 'STEP 1 // NEW VESSEL CALIBRATION WALKTHROUGH';
      }
      if (confirmBtn) {
        confirmBtn.textContent = '[LOCK DIFFICULTY & LAUNCH INTRO CUTSCENE ->]';
      }
      this.openModal('preferences-modal');
    },

    // Launched from Main Menu [3] PREFERENCES or In-Game [P] PREFS
    openPreferencesModal: function (walkthrough) {
      this.isWalkthroughMode = Boolean(walkthrough);
      var titleEl = document.getElementById('prefs-modal-title');
      var confirmBtn = document.getElementById('btn-confirm-preferences');

      if (titleEl) {
        titleEl.textContent = this.isWalkthroughMode
          ? 'STEP 1 // NEW VESSEL CALIBRATION WALKTHROUGH'
          : 'SYSTEM PREFERENCES & DIFFICULTY CALIBRATION';
      }
      if (confirmBtn) {
        confirmBtn.textContent = this.isWalkthroughMode
          ? '[LOCK DIFFICULTY & LAUNCH INTRO CUTSCENE ->]'
          : '[SAVE & CLOSE]';
      }
      this.openModal('preferences-modal');
    },

    setDifficulty: function (tierKey) {
      var tier = DIFFICULTY_TIERS[tierKey] || DIFFICULTY_TIERS.UNFORGIVING;
      V.Config.difficulty = tier.id;
      V.Config.difficultyMultiplier = tier.statMultiplier;
      V.Config.rotSpreadMultiplier = tier.rotSpreadMultiplier;
      V.Config.solaceRecoveryRestricted = tier.solaceRecoveryRestricted;

      var diffBtns = document.querySelectorAll('.diff-btn');
      for (var i = 0; i < diffBtns.length; i++) {
        var btn = diffBtns[i];
        var isMatch = btn.getAttribute('data-diff') === tier.id;
        btn.classList.toggle('active', isMatch);
      }

      var introBadge = document.getElementById('intro-diff-readout');
      if (introBadge) introBadge.textContent = tier.label;

      var builderBadge = document.getElementById('builder-diff-badge');
      if (builderBadge) builderBadge.textContent = tier.label;

      dispatchVermisEvent('VermisDifficultyChanged', { tier: tier });
    },

    getDifficultyLabel: function () {
      var tier = DIFFICULTY_TIERS[V.Config.difficulty] || DIFFICULTY_TIERS.UNFORGIVING;
      return tier.label;
    },

    cyclePalette: function () {
      var idx = PALETTE_ORDER.indexOf(V.Config.palette);
      var nextPalette = PALETTE_ORDER[(idx + 1) % PALETTE_ORDER.length];
      this.applyPalette(nextPalette);
    },

    applyPalette: function (paletteName) {
      var validPalette = PALETTE_ORDER.indexOf(paletteName) !== -1 ? paletteName : 'catacombs';
      V.Config.palette = validPalette;
      document.body.classList.remove('palette-catacombs', 'palette-flutewoods', 'palette-brutalist');
      document.body.classList.add('palette-' + validPalette);

      var btnModal = document.getElementById('btn-palette-modal');
      if (btnModal) {
        btnModal.textContent = 'PLATE: ' + validPalette.toUpperCase();
      }
      var btnChassis = document.getElementById('btn-palette');
      if (btnChassis) {
        btnChassis.textContent = 'PLATE: ' + validPalette.toUpperCase();
      }
    },

    toggleCRT: function () {
      this.applyCRT(!V.Config.crtEnabled);
    },

    applyCRT: function (enabled) {
      V.Config.crtEnabled = Boolean(enabled);
      document.body.classList.toggle('crt-enabled', V.Config.crtEnabled);
      document.body.classList.toggle('crt-bypass', !V.Config.crtEnabled);

      var btnCrtModal = document.getElementById('btn-crt-modal');
      if (btnCrtModal) {
        btnCrtModal.classList.toggle('active', V.Config.crtEnabled);
        btnCrtModal.textContent = 'CRT: ' + (V.Config.crtEnabled ? 'ON' : 'OFF');
      }
      var btnCrtChassis = document.getElementById('btn-crt');
      if (btnCrtChassis) {
        btnCrtChassis.classList.toggle('active', V.Config.crtEnabled);
        btnCrtChassis.textContent = 'CRT: ' + (V.Config.crtEnabled ? 'ON' : 'OFF');
      }
    },

    cycleFPS: function () {
      var idx = FPS_ORDER.indexOf(V.Config.fps);
      var nextFps = FPS_ORDER[(idx + 1) % FPS_ORDER.length];
      this.applyFPS(nextFps);
    },

    applyFPS: function (fpsVal) {
      var parsed = Number(fpsVal);
      V.Config.fps = FPS_ORDER.indexOf(parsed) !== -1 ? parsed : 12;
      var btnFps = document.getElementById('btn-fps-modal');
      if (btnFps) {
        btnFps.textContent = String(V.Config.fps) + ' FPS';
      }
    },

    // Strict MS-DOS Gyroscopic Sensor Lock (GYRO: OFF [LOCKED])
    enforceGyroLock: function () {
      V.Config.gyroEnabled = false;
      V.Config.gyroLocked = true;

      var gyroBtns = document.querySelectorAll('#btn-gyro, #btn-gyro-modal');
      for (var i = 0; i < gyroBtns.length; i++) {
        gyroBtns[i].classList.add('gyro-disabled');
        gyroBtns[i].classList.remove('active');
        gyroBtns[i].textContent = 'GYRO: OFF [LOCKED]';
      }

      var gyroBanner = document.getElementById('gyro-banner');
      if (gyroBanner) {
        gyroBanner.textContent = 'GYRO: LOCKED';
      }
    },

    // Multi-Pane Preferences Tab Switcher (DISPLAY / CONTROLS / DIFFICULTY / GRAPHICS)
    switchPrefsPane: function (paneId) {
      if (!paneId) return;
      var tabs = document.querySelectorAll('[data-prefs-tab]');
      for (var i = 0; i < tabs.length; i++) {
        var isMatch = tabs[i].getAttribute('data-prefs-tab') === paneId;
        tabs[i].classList.toggle('active', isMatch);
      }
      var panes = document.querySelectorAll('.prefs-pane, [data-prefs-pane]');
      for (var j = 0; j < panes.length; j++) {
        var pane = panes[j];
        var idMatch = (pane.id === paneId) || (pane.getAttribute('data-prefs-pane') === paneId);
        pane.hidden = !idMatch;
      }
    },

    applyDisplayFilters: function () {
      var stage = document.getElementById('raycast-view') || document.getElementById('visual-stage-canvas');
      if (!stage) return;
      var b = V.Config.brightness || 100;
      var c = V.Config.contrast || 100;
      stage.style.filter = 'brightness(' + b + '%) contrast(' + c + '%)';
    },

    applySavedConfig: function (savedCfg) {
      if (!savedCfg) return;
      if (savedCfg.difficulty) this.setDifficulty(savedCfg.difficulty);
      if (savedCfg.palette) this.applyPalette(savedCfg.palette);
      if (typeof savedCfg.crtEnabled === 'boolean') this.applyCRT(savedCfg.crtEnabled);
      if (savedCfg.fps) this.applyFPS(savedCfg.fps);
      this.enforceGyroLock();
    },

    openModal: function (modalId) {
      if (V.UI && typeof V.UI.openModal === 'function') {
        V.UI.openModal(modalId);
      } else {
        this.closeAllModals();
        var modal = document.getElementById(modalId);
        var backdrop = document.getElementById('modal-backdrop');
        if (modal) {
          modal.hidden = false;
          modal.classList.add('is-open');
        }
        if (backdrop) backdrop.hidden = false;
      }

      if (modalId === 'modal-vessel' && V.Character && typeof V.Character.syncVesselModal === 'function') {
        V.Character.syncVesselModal();
      }
      if (modalId === 'modal-map' && V.Raycaster && typeof V.Raycaster.renderCartographyMap === 'function') {
        V.Raycaster.renderCartographyMap();
      }

      dispatchVermisEvent('VermisModalOpened', { modalId: modalId });
    },

    closeModal: function (modalId) {
      if (V.UI && typeof V.UI.closeModal === 'function') {
        V.UI.closeModal(modalId);
        return;
      }
      var modal = document.getElementById(modalId);
      if (modal) {
        modal.hidden = true;
        modal.classList.remove('is-open');
      }
      var anyOpen = document.querySelector('.dos-modal.is-open');
      var backdrop = document.getElementById('modal-backdrop');
      if (!anyOpen && backdrop) backdrop.hidden = true;
    },

    closeAllModals: function () {
      if (V.UI && typeof V.UI.closeAllModals === 'function') {
        V.UI.closeAllModals();
        return;
      }
      var modalIds = ['modal-vessel', 'modal-inventory', 'modal-map', 'remap-modal', 'preferences-modal'];
      for (var i = 0; i < modalIds.length; i++) {
        var el = document.getElementById(modalIds[i]);
        if (el) {
          el.hidden = true;
          el.classList.remove('is-open');
        }
      }
      var backdrop = document.getElementById('modal-backdrop');
      if (backdrop) backdrop.hidden = true;
    },

    bindModalTriggers: function () {
      var self = this;

      // Difficulty Selector Grid inside #preferences-modal
      var diffBtns = document.querySelectorAll('.diff-btn');
      for (var i = 0; i < diffBtns.length; i++) {
        (function (btn) {
          V.bindAction(btn, 'click', function () {
            self.setDifficulty(btn.getAttribute('data-diff'));
          });
        })(diffBtns[i]);
      }

      // Multi-Pane Preferences Tab Buttons
      var prefTabs = document.querySelectorAll('[data-prefs-tab]');
      for (var t = 0; t < prefTabs.length; t++) {
        (function (tabBtn) {
          V.bindAction(tabBtn, 'click', function () {
            self.switchPrefsPane(tabBtn.getAttribute('data-prefs-tab'));
          });
        })(prefTabs[t]);
      }

      // Display Sliders (Brightness / Contrast) if present in #preferences-modal
      var brightSlider = document.getElementById('slider-brightness');
      if (brightSlider) {
        brightSlider.addEventListener('input', function (e) {
          V.Config.brightness = Number(e.target.value) || 100;
          self.applyDisplayFilters();
        }, false);
      }
      var contrastSlider = document.getElementById('slider-contrast');
      if (contrastSlider) {
        contrastSlider.addEventListener('input', function (e) {
          V.Config.contrast = Number(e.target.value) || 100;
          self.applyDisplayFilters();
        }, false);
      }

      // Lithography Calibration & Gyro Sensor Lock Buttons
      V.bindAction('#btn-palette-modal, #btn-palette', 'click', function () {
        self.cyclePalette();
      });
      V.bindAction('#btn-crt-modal, #btn-crt', 'click', function () {
        self.toggleCRT();
      });
      V.bindAction('#btn-fps-modal', 'click', function () {
        self.cycleFPS();
      });
      V.bindAction('#btn-gyro, #btn-gyro-modal', 'click', function () {
        self.enforceGyroLock();
        if (typeof V.logTelemetry === 'function') {
          V.logTelemetry('GYROSCOPIC SENSOR REMAINS HARDWARE-LOCKED [OFF BY DEFAULT].');
        }
      });

      // Confirm Preferences Button (Branches based on New Game Walkthrough vs. Mid-Game Modal)
      V.bindAction('#btn-confirm-preferences', 'click', function () {
        var wasWalkthrough = self.isWalkthroughMode;
        self.isWalkthroughMode = false;
        self.closeAllModals();
        if (wasWalkthrough && V.State && typeof V.State.confirmPreferencesWalkthrough === 'function') {
          V.State.confirmPreferencesWalkthrough();
        }
      });

      // Top HUD Bar Modal Buttons
      V.bindAction('#btn-modal-vessel', 'click', function () { self.openModal('modal-vessel'); });
      V.bindAction('#btn-modal-inventory', 'click', function () { self.openModal('modal-inventory'); });
      V.bindAction('#btn-open-map', 'click', function () { self.openModal('modal-map'); });
      V.bindAction('#btn-remap', 'click', function () { self.openModal('remap-modal'); });
      V.bindAction('#btn-preferences', 'click', function () { self.openPreferencesModal(false); });
      V.bindAction('.modal-close-btn, #modal-backdrop', 'click', function () { self.closeAllModals(); });

      // Diegetic Loupe Toggle (With strict Phase-Bleed Guard)
      V.bindAction('#btn-loupe, #btn-touch-loupe', 'click', function () {
        V.Config.loupeEnabled = !V.Config.loupeEnabled;
        var loupeEl = document.getElementById('loupe-inset');
        var btnLoupe = document.getElementById('btn-loupe');
        var isPlaying = V.State && (
          V.State.currentPhase === 'SPATIAL_HUNT' ||
          V.State.currentPhase === 'AUTO_PAUSE'
        );
        if (loupeEl) {
          loupeEl.hidden = !(isPlaying && V.Config.loupeEnabled);
        }
        if (btnLoupe) {
          btnLoupe.classList.toggle('active', V.Config.loupeEnabled);
          btnLoupe.textContent = 'LOUPE: ' + (V.Config.loupeEnabled ? 'ON' : 'OFF');
        }
      });

      // Mobile 2DS Touch Deck Visibility Toggle
      V.bindAction('#btn-touch-deck', 'click', function () {
        V.Config.touchDeckEnabled = !V.Config.touchDeckEnabled;
        var deck = document.getElementById('mobile-touch-deck');
        var btnTouch = document.getElementById('btn-touch-deck');
        if (deck) deck.hidden = !V.Config.touchDeckEnabled;
        if (btnTouch) {
          btnTouch.classList.toggle('active', V.Config.touchDeckEnabled);
          btnTouch.textContent = 'TOUCH: ' + (V.Config.touchDeckEnabled ? 'ON' : 'OFF');
        }
      });
    }
  };
})();

