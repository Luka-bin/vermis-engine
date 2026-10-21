/* ============================================================================
   VERMIS // MODULE 00 & 03.2: SYSTEM STATE, 3-STAGE BOOT PIPELINE & MASTER CLOCK
   File: js/core/state.js
   Target Version: v1.5.2 (Strict ES5 / Mobile-Safe / Zero Inline HTML)
   Flow: BOOT -> TITLE_SCREEN -> MAIN_MENU -> PREFERENCES_WALKTHROUGH -> INTRO -> CREATION -> SPATIAL_HUNT
   ============================================================================ */

window.VERMIS = window.VERMIS || {};

(function () {
  'use strict';

  var V = window.VERMIS;
  var SAVE_STORAGE_KEY = 'VERMIS_SAVE_STATE';

  // Ensure baseline configuration & input abstractions exist before other modules load
  V.Config = V.Config || {};
  var defaultConfig = {
    fps: 12,
    palette: 'catacombs',
    crtEnabled: true,
    loupeEnabled: false,
    gyroEnabled: false, // Strictly locked OFF by default per MS-DOS specification
    gyroLocked: true,
    touchDeckEnabled: true,
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

  V.inputMap = V.inputMap || {};
  var defaultInputs = {
    ACTION_MOVE_FORWARD: false,
    ACTION_MOVE_BACKWARD: false,
    ACTION_STRAFE_LEFT: false,
    ACTION_STRAFE_RIGHT: false,
    ACTION_TURN_LEFT: false,
    ACTION_TURN_RIGHT: false,
    ACTION_LOUPE_HOLD: false,
    ACTION_ATTACK: false,
    mouseDeltaX: 0
  };

  for (var inpKey in defaultInputs) {
    if (Object.prototype.hasOwnProperty.call(defaultInputs, inpKey)) {
      if (typeof V.inputMap[inpKey] === 'undefined') {
        V.inputMap[inpKey] = defaultInputs[inpKey];
      }
    }
  }

  if (!V.inputMap.keyBindings) {
    V.inputMap.keyBindings = {
      ACTION_MOVE_FORWARD: 'W',
      ACTION_MOVE_BACKWARD: 'S',
      ACTION_STRAFE_LEFT: 'A',
      ACTION_STRAFE_RIGHT: 'D',
      ACTION_TURN_LEFT: 'Q',
      ACTION_TURN_RIGHT: 'E',
      ACTION_LOUPE_HOLD: 'F',
      ACTION_ATTACK: 'LMB / RT'
    };
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

  // Strip HTML tags if legacy callers pass markup strings into V.logTelemetry
  function stripTags(str) {
    return String(str || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }

  // Rolling Telemetry Logger (Zero Inline HTML)
  V.logTelemetry = function (messageText, isAlert) {
    var logDeck = document.getElementById('rolling-telemetry-deck');
    if (!logDeck) return;
    var entry = document.createElement('div');
    entry.className = isAlert ? 'log-entry alert-line' : 'log-entry';
    entry.textContent = '> ' + stripTags(messageText);
    logDeck.appendChild(entry);
    while (logDeck.children.length > 6) {
      logDeck.removeChild(logDeck.firstChild);
    }
    logDeck.scrollTop = logDeck.scrollHeight;
  };

  // ==========================================================================
  // CORE STATE CONTROLLER (window.VERMIS.State)
  // ==========================================================================
  V.State = {
    isInitialized: false,
    _inSetPhaseView: false,
    currentPhase: 'BOOT',       // BOOT | TITLE_SCREEN | MAIN_MENU | PREFERENCES_WALKTHROUGH | INTRO | CREATION | SPATIAL_HUNT | AUTO_PAUSE
    mode: 'SPATIAL_HUNT',       // Mode A: 'SPATIAL_HUNT' | Mode B: 'AUTO_PAUSE'
    isProcessingChoice: false,  // Module 03.2 UI Re-Entrancy Lock
    activeInterrupt: null,      // Active collision/event payload during Mode B
    biosTimer: null,

    // Master Game Loop Clock State
    clockRunning: false,
    lastFrameTime: 0,
    steppedTime: -1,

    // Runtime Vessel & World State
    vessel: {
      distinction: 'Miner Knight',
      solace: 3,
      maxSolace: 5,
      malignancy: 0,
      complications: 2,
      maxComplications: 12,
      rotTier: 1,
      activeBuffs: []
    },

    // 1. OS Boot Sequence & CRT Cathode Warmup
    initializeSystem: function () {
      if (this.isInitialized) return;
      this.isInitialized = true;

      if (V.Settings && typeof V.Settings.initialize === 'function') {
        V.Settings.initialize();
      }

      var screenEl = document.getElementById('screen');
      if (screenEl) {
        screenEl.classList.add('cr-monitor-bezel');
      }

      this.bindCoreNavigation();
      this.startMasterClock();

      // If index.html already advanced past BOOT before state.js mounted, respect it
      if (this.currentPhase && this.currentPhase !== 'BOOT') {
        this.setPhaseView(this.currentPhase);
        return;
      }

      if (screenEl) {
        screenEl.classList.add('booting');
      }
      this.setPhaseView('BOOT');
      this.runBiosSequence();
    },

    // 2. Stage 1: Live Pip-Boy / MS-DOS Boot Loader in #boot-sequence-terminal -> TITLE_SCREEN
    runBiosSequence: function () {
      var self = this;
      var biosLog = document.getElementById('bios-post-log');
      var mainMenuHub = document.getElementById('main-menu-hub');
      var mainMenuView = document.getElementById('main-menu-view');
      var titleScreenView = document.getElementById('title-screen-view');

      if (mainMenuHub) mainMenuHub.hidden = true;
      if (mainMenuView) mainMenuView.hidden = true;
      if (titleScreenView) titleScreenView.hidden = true;

      // If index.html inline loader is already driving #bios-post-log, wait for completion
      if (biosLog && biosLog.textContent && biosLog.textContent.length > 10) {
        if (biosLog.textContent.indexOf('SYSTEM READY') !== -1 || biosLog.textContent.indexOf('AWAITING') !== -1) {
          this.biosTimer = setTimeout(function () {
            if (self.currentPhase === 'BOOT') {
              self.showTitleScreen();
            }
          }, 900);
          return;
        }
      }

      var postLines = [
        'VERMIS BIOS POST CHECK v1.5.2',
        'CHECKING EXTENDED MEMORY .......... 640K OK',
        'INITIALIZING 8x8 BAYER LUT ........ OK',
        'LOADING LITHOGRAPHY SHADERS ....... OK',
        'MOUNTING WALKER LABYRINTH SEED .... OK',
        'GYROSCOPIC SENSOR LOCK ............ ENGAGED [OFF]',
        'SYSTEM READY.'
      ];

      if (!biosLog) {
        this.biosTimer = setTimeout(function () {
          self.showTitleScreen();
        }, 1200);
        return;
      }

      // Pure DOM typing sequence (zero innerHTML)
      biosLog.textContent = '';
      var textNode = document.createTextNode('');
      var cursorSpan = document.createElement('span');
      cursorSpan.className = 'cursor-blink';
      cursorSpan.textContent = '_';
      biosLog.appendChild(textNode);
      biosLog.appendChild(cursorSpan);

      var lineIdx = 0;
      var charIdx = 0;
      var accumulated = '';

      function typeNextChar() {
        if (self.currentPhase !== 'BOOT') return;

        if (lineIdx >= postLines.length) {
          if (cursorSpan.parentNode) {
            cursorSpan.parentNode.removeChild(cursorSpan);
          }
          self.biosTimer = setTimeout(function () {
            self.showTitleScreen();
          }, 450);
          return;
        }

        var currentLine = postLines[lineIdx];
        accumulated += currentLine.charAt(charIdx);
        textNode.nodeValue = accumulated;
        charIdx++;

        if (charIdx >= currentLine.length) {
          accumulated += '\n';
          textNode.nodeValue = accumulated;
          lineIdx++;
          charIdx = 0;
          setTimeout(typeNextChar, 110);
        } else {
          setTimeout(typeNextChar, 18);
        }
      }

      setTimeout(typeNextChar, 180);
    },

    // 3. Stage 2: Transition from BOOT -> TITLE_SCREEN (#title-screen-view)
    showTitleScreen: function () {
      var screenEl = document.getElementById('screen');
      if (screenEl) screenEl.classList.remove('booting');

      var titleView = document.getElementById('title-screen-view');
      if (titleView) {
        this.setPhaseView('TITLE_SCREEN');
      } else {
        // Graceful fallback if #title-screen-view is absent in an older HTML shell
        this.showMainMenu();
      }
    },

    // 4. Stage 3: Transition from TITLE_SCREEN -> Clean MAIN_MENU (#main-menu-view without BIOS log)
    showMainMenu: function () {
      var screenEl = document.getElementById('screen');
      if (screenEl) screenEl.classList.remove('booting');

      this.setPhaseView('MAIN_MENU');
    },

    // 5. [1] NEW GAME -> Mandatory Preferences Walkthrough Wizard
    startNewVessel: function () {
      this.setPhaseView('PREFERENCES_WALKTHROUGH');
      if (V.Settings && typeof V.Settings.startSetupWalkthrough === 'function') {
        V.Settings.startSetupWalkthrough();
      }
    },

    // 6. Confirm Preferences Walkthrough -> Trigger Intro Cutscene
    confirmPreferencesWalkthrough: function () {
      var self = this;
      if (V.Settings && typeof V.Settings.closeModal === 'function') {
        V.Settings.closeModal('preferences-modal');
      }
      this.setPhaseView('INTRO');

      var diffReadout = document.getElementById('intro-diff-readout');
      if (diffReadout && V.Settings && typeof V.Settings.getDifficultyLabel === 'function') {
        diffReadout.textContent = V.Settings.getDifficultyLabel();
      }

      this.playIntroCutscene().then(function () {
        self.enterCreationPhase();
      });
    },

    playIntroCutscene: function () {
      var self = this;
      return new Promise(function (resolve) {
        self._introResolve = resolve;
      });
    },

    enterCreationPhase: function () {
      this.setPhaseView('CREATION');
      var builderDiffBadge = document.getElementById('builder-diff-badge');
      if (builderDiffBadge && V.Settings && typeof V.Settings.getDifficultyLabel === 'function') {
        builderDiffBadge.textContent = V.Settings.getDifficultyLabel();
      }
      if (V.Character && typeof V.Character.renderBuilder === 'function') {
        V.Character.renderBuilder();
      }
      dispatchVermisEvent('VermisCreationPhaseEntered', {
        vessel: this.vessel,
        config: V.Config
      });
    },

    // 7. Intro Cutscene Skip / Proceed Handler -> Resolves Intro Promise & Enters CREATION
    proceedToCreation: function () {
      if (typeof this._introResolve === 'function') {
        var res = this._introResolve;
        this._introResolve = null;
        res();
        return;
      }
      this.enterCreationPhase();
    },

    // 8. Finalize Vessel Creation -> Save to LocalStorage & Enter Mode A (SPATIAL_HUNT)
    finalizeVesselAndDescend: function () {
      if (V.Character && typeof V.Character.exportVesselState === 'function') {
        var builtData = V.Character.exportVesselState();
        this.vessel.distinction = builtData.distinction;
        this.vessel.solace = builtData.solace;
        this.vessel.maxSolace = builtData.maxSolace;
      } else {
        var selectEl = document.getElementById('distinction-select');
        var solaceEl = document.getElementById('stat-solace');
        if (selectEl && selectEl.value) this.vessel.distinction = selectEl.value;
        if (solaceEl) this.vessel.solace = Number(solaceEl.textContent) || 3;
      }

      this.saveStateToStorage();
      this.syncTelemetryHeader();
      this.mode = 'SPATIAL_HUNT';
      this.isProcessingChoice = false;
      this.setPhaseView('SPATIAL_HUNT');

      if (V.Raycaster && typeof V.Raycaster.renderCartographyMap === 'function') {
        V.Raycaster.renderCartographyMap();
      }

      V.logTelemetry(
        'VESSEL INITIALIZED: [' + String(this.vessel.distinction).toUpperCase() + '] // DIFFICULTY: ' +
        V.Config.difficulty + ' (' + Number(V.Config.difficultyMultiplier || 1.0).toFixed(1) + 'x)'
      );
    },

    // 9. [2] LOAD SAVED VESSEL from LocalStorage
    restoreState: function () {
      var raw = null;
      try {
        raw = localStorage.getItem(SAVE_STORAGE_KEY);
      } catch (e) {
        raw = null;
      }

      if (!raw) {
        var menuErrorEl = document.getElementById('menu-error-readout') || document.getElementById('bios-post-log');
        if (menuErrorEl && menuErrorEl.textContent.indexOf('ERROR: NO SAVED VESSEL') === -1) {
          menuErrorEl.textContent += '\nERROR: NO SAVED VESSEL FOUND IN LOCAL STORAGE.';
        }
        V.logTelemetry('ERROR: NO SAVED VESSEL FOUND IN LOCAL STORAGE.', true);
        return false;
      }

      try {
        var parsed = JSON.parse(raw);
        if (parsed.vessel) {
          for (var k in parsed.vessel) {
            if (Object.prototype.hasOwnProperty.call(parsed.vessel, k)) {
              this.vessel[k] = parsed.vessel[k];
            }
          }
        } else if (parsed.distinction) {
          this.vessel.distinction = parsed.distinction;
          this.vessel.solace = typeof parsed.solace === 'number' ? parsed.solace : 3;
          this.vessel.complications = typeof parsed.complications === 'number' ? parsed.complications : 2;
          this.vessel.malignancy = typeof parsed.malignancy === 'number' ? parsed.malignancy : 0;
        }

        if (parsed.stats && V.Character && typeof V.Character.importStats === 'function') {
          V.Character.importStats(parsed.stats, typeof parsed.buildPoints === 'number' ? parsed.buildPoints : 0);
        }

        if (parsed.config && V.Settings && typeof V.Settings.applySavedConfig === 'function') {
          V.Settings.applySavedConfig(parsed.config);
        }

        if (V.Settings && typeof V.Settings.closeAllModals === 'function') {
          V.Settings.closeAllModals();
        }

        this.syncTelemetryHeader();
        this.mode = 'SPATIAL_HUNT';
        this.isProcessingChoice = false;
        this.setPhaseView('SPATIAL_HUNT');

        if (V.Raycaster && typeof V.Raycaster.renderCartographyMap === 'function') {
          V.Raycaster.renderCartographyMap();
        }

        V.logTelemetry('RESTORED SAVED VESSEL [' + String(this.vessel.distinction).toUpperCase() + '].');
        return true;
      } catch (err) {
        V.logTelemetry('SAVE CORRUPTED. UNABLE TO RESTORE VESSEL.', true);
        return false;
      }
    },

    saveStateToStorage: function () {
      var payload = {
        timestamp: Date.now(),
        vessel: this.vessel,
        stats: (V.Character && typeof V.Character.getRawBuilderStats === 'function')
          ? V.Character.getRawBuilderStats()
          : null,
        buildPoints: (V.Character && typeof V.Character.getRemainingBuildPoints === 'function')
          ? V.Character.getRemainingBuildPoints()
          : 0,
        config: V.Config
      };
      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        // Ignore storage quota or sandbox restrictions
      }
    },

    // ========================================================================
    // MASTER GAME CLOCK (Supports both v1.5.2 and v1.4.1 Raycaster & Shader APIs)
    // ========================================================================
    startMasterClock: function () {
      if (this.clockRunning) return;
      this.clockRunning = true;
      this.lastFrameTime = performance.now();
      var self = this;

      function tick(now) {
        var dt = Math.min(0.1, (now - self.lastFrameTime) / 1000);
        self.lastFrameTime = now;

        var isPlaying = (
          self.currentPhase === 'SPATIAL_HUNT' ||
          self.currentPhase === 'AUTO_PAUSE'
        );

        if (isPlaying) {
          // Real-Time Spatial Exploration updates execute strictly in Mode A (SPATIAL_HUNT)
          if (self.currentPhase === 'SPATIAL_HUNT' && self.mode === 'SPATIAL_HUNT') {
            if (V.Raycaster) {
              if (typeof V.Raycaster.update === 'function') {
                V.Raycaster.update(dt);
              } else if (typeof V.Raycaster.updateSpatialMovement === 'function') {
                V.Raycaster.updateSpatialMovement(dt);
              }
            }
            if (V.Combat && typeof V.Combat.updateRecovery === 'function') {
              V.Combat.updateRecovery(dt);
            }
            if (V.Character && typeof V.Character.tickTimers === 'function') {
              V.Character.tickTimers(dt);
            }
          }

          // Quantized Lithography & Bestiary Render Pass (12 / 24 / 60 FPS)
          var targetFps = V.Config.fps || 12;
          var stepInterval = 1.0 / targetFps;
          var rawTime = now * 0.001;
          var quantizedTime = targetFps >= 60
            ? rawTime
            : Math.floor(rawTime / stepInterval) * stepInterval;

          if (quantizedTime !== self.steppedTime || targetFps >= 60) {
            self.steppedTime = quantizedTime;

            if (V.Raycaster) {
              if (typeof V.Raycaster.render === 'function') {
                V.Raycaster.render(quantizedTime, stepInterval);
              } else if (typeof V.Raycaster.renderDungeonGBuffer === 'function') {
                V.Raycaster.renderDungeonGBuffer(quantizedTime);
                var hasShaderPass = V.Shader && (
                  typeof V.Shader.executePass === 'function' ||
                  typeof V.Shader.renderPass === 'function'
                );
                if (!hasShaderPass && typeof V.Raycaster.presentFallbackLitho === 'function') {
                  V.Raycaster.presentFallbackLitho();
                }
              }
            }

            if (V.Billboard && typeof V.Billboard.render === 'function') {
              V.Billboard.render(quantizedTime, stepInterval);
            }

            if (V.Shader) {
              if (typeof V.Shader.executePass === 'function') {
                V.Shader.executePass(quantizedTime);
              } else if (typeof V.Shader.renderPass === 'function') {
                V.Shader.renderPass(quantizedTime);
              }
            }
          }
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    },

    // Alias for index.html v1.5.1/v1.5.2 force-boot verification hooks
    startEngineLoop: function () {
      this.startMasterClock();
    },

    // ========================================================================
    // MODULE 03.2: SPATIAL TRIGGER INVALIDATION & MODE A <-> MODE B GATES
    // ========================================================================
    evaluateProximityTrigger: function (tile) {
      if (this.mode !== 'SPATIAL_HUNT') return false;
      if (!tile || !tile.hasEvent || tile.consumed) return false;

      // Pre-invalidate BEFORE executing payload to prevent infinite trigger loops
      tile.consumed = true;
      this.triggerAutoPauseInterrupt({
        id: tile.id || 'spatial_hazard',
        title: tile.title || 'THE STENCH CHAMPION STRIKE',
        tn: Math.round((tile.baseTN || 7) * (V.Config.difficultyMultiplier || 1.0))
      });
      return true;
    },

    triggerAutoPauseInterrupt: function (interruptPayload) {
      if (this.mode === 'AUTO_PAUSE') return;
      this.mode = 'AUTO_PAUSE';
      this.isProcessingChoice = false;
      this.activeInterrupt = interruptPayload || {
        id: 'stench_cleaver',
        title: 'THE STENCH CHAMPION STRIKE',
        tn: Math.round(7 * (V.Config.difficultyMultiplier || 1.0))
      };

      this.setPhaseView('AUTO_PAUSE');

      var screenEl = document.getElementById('screen');
      if (screenEl) screenEl.classList.add('trauma-critical');

      V.logTelemetry(
        'AUTO-PAUSE INTERRUPT // ' + this.activeInterrupt.title + ' [TN: ' + this.activeInterrupt.tn + ']',
        true
      );
    },

    resolveTacticalChoice: function (choiceKey) {
      var self = this;
      // Strict State Gate & Dual-Layer Re-Entrancy Lock
      if (this.mode !== 'AUTO_PAUSE' || this.isProcessingChoice) return;
      this.isProcessingChoice = true;

      var choiceDeck = document.getElementById('choice-deck');
      if (choiceDeck) {
        choiceDeck.style.pointerEvents = 'none';
      }

      if (V.Combat && typeof V.Combat.resolveInterruptChoice === 'function') {
        V.Combat.resolveInterruptChoice(String(choiceKey), this.vessel, this.activeInterrupt);
      } else {
        var key = String(choiceKey);
        if (key === '1') {
          if (this.vessel.solace > 0) {
            this.vessel.solace -= 1;
            this.vessel.malignancy += 1;
            V.logTelemetry(
              'BURNED 1 SOLACE (+3 AV) // CLEAVER DEFLECTED. MALIGNANCY INCREASED TO ' + this.vessel.malignancy + '.'
            );
          } else {
            this.vessel.complications = Math.min(this.vessel.maxComplications, this.vessel.complications + 1);
            V.logTelemetry('SOLACE DEPLETED // FORCED IMPACT: +1 COMPLICATION DRAG.', true);
          }
        } else if (key === '2') {
          this.vessel.complications = Math.min(this.vessel.maxComplications, this.vessel.complications + 1);
          V.logTelemetry(
            'IMPACT ACCEPTED // GAINED COMPLICATION: SHATTERED RIBS (TRAUMAS: ' +
            this.vessel.complications + '/' + this.vessel.maxComplications + ').',
            true
          );
        } else if (key === '3') {
          V.logTelemetry(
            'INVOKED DISTINCTION [' + String(this.vessel.distinction).toUpperCase() + '] (+2 AV) // STEPPED INTO CATACOMB DRAFT.'
          );
        } else if (key === '4') {
          V.logTelemetry('EXERTED FLESH (+2 AV) // BACKPEDALED OUT OF 1.5s TELEGRAPH ARC.');
        }
      }

      this.syncTelemetryHeader();
      this.saveStateToStorage();

      setTimeout(function () {
        if (choiceDeck) {
          choiceDeck.hidden = true;
          choiceDeck.style.pointerEvents = 'none';
        }
        var screenEl = document.getElementById('screen');
        if (screenEl && self.vessel.complications < 8) {
          screenEl.classList.remove('trauma-critical');
        }
        self.mode = 'SPATIAL_HUNT';
        self.activeInterrupt = null;
        self.isProcessingChoice = false;
        self.setPhaseView('SPATIAL_HUNT');
      }, 420);
    },

    syncTelemetryHeader: function () {
      var elTraumas = document.getElementById('val-traumas');
      var elSolace = document.getElementById('val-solace');
      var elMalignancy = document.getElementById('val-malignancy');
      var elDistinction = document.getElementById('val-distinction');

      if (elTraumas) {
        elTraumas.textContent = String(this.vessel.complications) + '/' + String(this.vessel.maxComplications);
      }
      if (elSolace) {
        elSolace.textContent = String(this.vessel.solace);
      }
      if (elMalignancy) {
        elMalignancy.textContent = String(this.vessel.malignancy);
      }
      if (elDistinction) {
        var uNode = elDistinction.querySelector('u');
        if (uNode) {
          uNode.textContent = String(this.vessel.distinction).toUpperCase();
        } else {
          elDistinction.textContent = String(this.vessel.distinction).toUpperCase();
        }
      }
    },

    // ========================================================================
    // 3-STAGE BOOT/TITLE/MENU & GAMEPLAY PHASE VIEW CONTROLLER
    // ========================================================================
    setPhaseView: function (phaseName) {
      this.currentPhase = phaseName;

      // Guarantee Mode A / Mode B state alignment on phase transition
      if (phaseName === 'SPATIAL_HUNT') {
        this.mode = 'SPATIAL_HUNT';
        this.isProcessingChoice = false;
      } else if (phaseName === 'AUTO_PAUSE') {
        this.mode = 'AUTO_PAUSE';
      }

      // Notify Module 01 VERMIS.UI if present (guarded against circular recursion)
      if (!this._inSetPhaseView && V.UI && typeof V.UI.setPhaseView === 'function') {
        this._inSetPhaseView = true;
        try {
          V.UI.setPhaseView(phaseName);
        } finally {
          this._inSetPhaseView = false;
        }
      }

      // Enforce v1.5.2 3-Stage Boot/Title/Menu & #choice-deck DOM states directly
      var phaseBadge = document.getElementById('phase-badge');
      if (phaseBadge) phaseBadge.textContent = '[PHASE: ' + phaseName + ']';

      var bootView = document.getElementById('boot-sequence-terminal');
      var titleView = document.getElementById('title-screen-view');
      var mainMenuView = document.getElementById('main-menu-view');
      var mainMenuHub = document.getElementById('main-menu-hub');
      var introView = document.getElementById('intro-cutscene-view');
      var builderView = document.getElementById('builder-view');
      var inGameHud = document.getElementById('in-game-hud');
      var gameplayStage = document.getElementById('gameplay-stage');
      var terminalDeck = document.getElementById('terminal-deck');
      var mobileTouchDeck = document.getElementById('mobile-touch-deck');
      var choiceDeck = document.getElementById('choice-deck');
      var loupeInset = document.getElementById('loupe-inset');
      var promptStatus = document.getElementById('prompt-status');

      var isPlaying = (phaseName === 'SPATIAL_HUNT' || phaseName === 'AUTO_PAUSE');
      var isMenuOrPrefs = (phaseName === 'MAIN_MENU' || phaseName === 'PREFERENCES_WALKTHROUGH');

      // 1. BOOT -> TITLE_SCREEN -> MAIN_MENU separation
      if (mainMenuView) {
        // v1.5.2 Dedicated #main-menu-view architecture (BIOS log never visible on Main Menu)
        if (bootView) bootView.hidden = (phaseName !== 'BOOT');
        if (titleView) titleView.hidden = (phaseName !== 'TITLE_SCREEN');
        mainMenuView.hidden = !isMenuOrPrefs;
        if (mainMenuHub) mainMenuHub.hidden = !isMenuOrPrefs;
      } else {
        // Legacy fallback if #main-menu-view is nested inside #boot-sequence-terminal
        if (titleView) titleView.hidden = (phaseName !== 'TITLE_SCREEN');
        if (bootView) bootView.hidden = !(phaseName === 'BOOT' || isMenuOrPrefs);
        if (mainMenuHub) mainMenuHub.hidden = !isMenuOrPrefs;
        var biosLog = document.getElementById('bios-post-log');
        if (biosLog) biosLog.hidden = (phaseName !== 'BOOT');
      }

      if (introView) introView.hidden = (phaseName !== 'INTRO');
      if (builderView) builderView.hidden = (phaseName !== 'CREATION');

      if (inGameHud) inGameHud.hidden = !isPlaying;
      if (gameplayStage) gameplayStage.hidden = !isPlaying;
      if (terminalDeck) terminalDeck.hidden = !isPlaying;
      if (mobileTouchDeck) {
        mobileTouchDeck.hidden = !(isPlaying && V.Config.touchDeckEnabled !== false);
      }

      // 2. Strict #choice-deck gate: NEVER visible unless phaseName === 'AUTO_PAUSE'
      if (choiceDeck) {
        var showChoices = (phaseName === 'AUTO_PAUSE');
        choiceDeck.hidden = !showChoices;
        choiceDeck.style.pointerEvents = showChoices ? 'auto' : 'none';
      }

      // 3. Strict #loupe-inset phase-bleed guard
      if (loupeInset) {
        loupeInset.hidden = !(isPlaying && V.Config.loupeEnabled);
      }

      if (promptStatus && isPlaying) {
        promptStatus.textContent = phaseName === 'AUTO_PAUSE'
          ? 'MODE B [AUTO_PAUSE] // SELECT TACTICAL TRIAGE [1]-[4]'
          : 'MODE A [SPATIAL_HUNT] // [WASD/DPAD] MOVE, [Q/E] HOTKEYS, [F] LOUPE';
      }

      dispatchVermisEvent('VermisPhaseChanged', {
        phase: phaseName,
        mode: this.mode
      });
    },

    bindCoreNavigation: function () {
      var self = this;

      // Stage 2 -> Stage 3: Title Screen to Clean Main Menu
      V.bindAction('[data-action="enter_title"], #btn-enter-title, #title-screen-view', 'click', function () {
        if (self.currentPhase === 'TITLE_SCREEN') {
          self.showMainMenu();
        }
      });

      // Main Menu Directives
      V.bindAction('[data-action="new_game"], #btn-new-vessel', 'click', function () {
        self.startNewVessel();
      });
      V.bindAction('[data-action="load_game"], #btn-load-vessel', 'click', function () {
        self.restoreState();
      });
      V.bindAction('[data-action="menu_prefs"], #btn-menu-prefs', 'click', function () {
        if (V.Settings) V.Settings.openPreferencesModal(false);
      });
      V.bindAction('[data-action="dev_skip"], #btn-dev-skip', 'click', function () {
        if (V.Settings) V.Settings.closeAllModals();
        self.syncTelemetryHeader();
        self.mode = 'SPATIAL_HUNT';
        self.isProcessingChoice = false;
        self.setPhaseView('SPATIAL_HUNT');
      });
      V.bindAction('[data-action="skip_intro"], #btn-skip-intro', 'click', function () {
        self.proceedToCreation();
      });
      V.bindAction('[data-action="finalize_build"]', 'click', function () {
        self.finalizeVesselAndDescend();
      });

      // Dispatches VermisDoomedSeedRequested for Module 03 (character.js)
      V.bindAction('[data-action="doomed_seed"]', 'click', function () {
        if (V.Character && typeof V.Character.randomizeDoomedSeed === 'function') {
          V.Character.randomizeDoomedSeed();
        } else {
          dispatchVermisEvent('VermisDoomedSeedRequested', {});
        }
      });

      V.bindAction('#btn-nav-menu', 'click', function () {
        if (V.Settings) V.Settings.closeAllModals();
        self.showMainMenu();
      });

      V.bindAction('#btn-sim-autopause, #btn-touch-enc', 'click', function () {
        self.triggerAutoPauseInterrupt();
      });

      V.bindAction('.choice-row', 'click', function (e) {
        var target = e.target || e.srcElement;
        var row = target && target.closest ? target.closest('.choice-row') : target;
        if (row) {
          var key = row.getAttribute('data-key') || row.getAttribute('data-choice');
          self.resolveTacticalChoice(key);
        }
      });

      // Keyboard [1]-[4] Tactical Choice & Title Screen Enter Support
      window.addEventListener('keydown', function (e) {
        if (self.currentPhase === 'TITLE_SCREEN' && (e.key === 'Enter' || e.key === ' ')) {
          self.showMainMenu();
          return;
        }
        if (self.mode === 'AUTO_PAUSE' && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4')) {
          self.resolveTacticalChoice(e.key);
        }
      }, false);
    }
  };

  // Auto-Boot when loaded via dynamic loader or after DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      V.State.initializeSystem();
    }, false);
  } else {
    V.State.initializeSystem();
  }
})();

