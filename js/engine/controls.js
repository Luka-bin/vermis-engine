/**
 * VERMIS ENGINE // MODULE 02 & 02.1: INPUT ABSTRACTION, 8-WAY MOBILITY & VPAD EDITOR [v1.5.2]
 * File: js/engine/controls.js (Dual-path compatible with js/ui/controls.js & js/controls.js)
 * Purpose: Decoupled Action Map, setActionState() Bridge, 8-Way D-Pad/Touchpad Mobility,
 *          Per-Widget Virtual Gamepad Layout Editor (VERMIS_PAD_LAYOUT_V1), & [Q]/[E] Hotkeys.
 */
(function () {
  'use strict';

  var VERMIS = (window.VERMIS = window.VERMIS || {});
  VERMIS.Config = VERMIS.Config || {};

  var STORAGE_KEY_VPAD = 'VERMIS_PAD_LAYOUT_V1';

  var ACTIONS = {
    MOVE_FORWARD:  'ACTION_MOVE_FORWARD',
    MOVE_BACKWARD: 'ACTION_MOVE_BACKWARD',
    STRAFE_LEFT:   'ACTION_STRAFE_LEFT',
    STRAFE_RIGHT:  'ACTION_STRAFE_RIGHT',
    TURN_LEFT:     'ACTION_TURN_LEFT',
    TURN_RIGHT:    'ACTION_TURN_RIGHT',
    ATTACK:        'ACTION_ATTACK',
    LOUPE:         'ACTION_LOUPE',
    HOTKEY_Q:      'ACTION_HOTKEY_Q',
    HOTKEY_E:      'ACTION_HOTKEY_E',
    CHOICE_1:      'ACTION_CHOICE_1',
    CHOICE_2:      'ACTION_CHOICE_2',
    CHOICE_3:      'ACTION_CHOICE_3',
    CHOICE_4:      'ACTION_CHOICE_4'
  };

  var DEFAULT_BINDINGS = {
    ACTION_MOVE_FORWARD:  { key: 'KeyW',       gamepadBtn: null, gamepadAxis: [1, -1], label: 'W' },
    ACTION_MOVE_BACKWARD: { key: 'KeyS',       gamepadBtn: null, gamepadAxis: [1,  1], label: 'S' },
    ACTION_STRAFE_LEFT:   { key: 'KeyA',       gamepadBtn: null, gamepadAxis: [0, -1], label: 'A' },
    ACTION_STRAFE_RIGHT:  { key: 'KeyD',       gamepadBtn: null, gamepadAxis: [0,  1], label: 'D' },
    ACTION_TURN_LEFT:     { key: 'ArrowLeft',  gamepadBtn: null, gamepadAxis: [2, -1], label: 'LEFT' },
    ACTION_TURN_RIGHT:    { key: 'ArrowRight', gamepadBtn: null, gamepadAxis: [2,  1], label: 'RIGHT' },
    ACTION_ATTACK:        { key: 'Mouse0',     gamepadBtn: 7,    gamepadAxis: null,    label: 'LMB / RT' },
    ACTION_LOUPE:         { key: 'KeyF',       gamepadBtn: 6,    gamepadAxis: null,    label: 'F / LT' },
    ACTION_HOTKEY_Q:      { key: 'KeyQ',       gamepadBtn: 14,   gamepadAxis: null,    label: 'Q' },
    ACTION_HOTKEY_E:      { key: 'KeyE',       gamepadBtn: 15,   gamepadAxis: null,    label: 'E' },
    ACTION_CHOICE_1:      { key: 'Digit1',     gamepadBtn: 0,    gamepadAxis: null,    label: '1 / [A]' },
    ACTION_CHOICE_2:      { key: 'Digit2',     gamepadBtn: 1,    gamepadAxis: null,    label: '2 / [B]' },
    ACTION_CHOICE_3:      { key: 'Digit3',     gamepadBtn: 2,    gamepadAxis: null,    label: '3 / [X]' },
    ACTION_CHOICE_4:      { key: 'Digit4',     gamepadBtn: 3,    gamepadAxis: null,    label: '4 / [Y]' }
  };

  var EIGHT_WAY_DIRS = [
    { angle: 0,               dx:  1, dy:  0, name: 'E'  },
    { angle: Math.PI * 0.25,  dx:  1, dy:  1, name: 'SE' },
    { angle: Math.PI * 0.5,   dx:  0, dy:  1, name: 'S'  },
    { angle: Math.PI * 0.75,  dx: -1, dy:  1, name: 'SW' },
    { angle: Math.PI,         dx: -1, dy:  0, name: 'W'  },
    { angle: -Math.PI * 0.75, dx: -1, dy: -1, name: 'NW' },
    { angle: -Math.PI * 0.5,  dx:  0, dy: -1, name: 'N'  },
    { angle: -Math.PI * 0.25, dx:  1, dy: -1, name: 'NE' }
  ];

  // Map data-dpad tokens to canonical engine actions (supports cardinal & diagonal octants)
  var DPAD_MAP = {
    up:                   [ACTIONS.MOVE_FORWARD],
    n:                    [ACTIONS.MOVE_FORWARD],
    forward:              [ACTIONS.MOVE_FORWARD],
    action_move_forward:  [ACTIONS.MOVE_FORWARD],
    down:                 [ACTIONS.MOVE_BACKWARD],
    s:                    [ACTIONS.MOVE_BACKWARD],
    backward:             [ACTIONS.MOVE_BACKWARD],
    action_move_backward: [ACTIONS.MOVE_BACKWARD],
    left:                 [ACTIONS.STRAFE_LEFT],
    w:                    [ACTIONS.STRAFE_LEFT],
    strafe_left:          [ACTIONS.STRAFE_LEFT],
    action_strafe_left:   [ACTIONS.STRAFE_LEFT],
    right:                [ACTIONS.STRAFE_RIGHT],
    e:                    [ACTIONS.STRAFE_RIGHT],
    strafe_right:         [ACTIONS.STRAFE_RIGHT],
    action_strafe_right:  [ACTIONS.STRAFE_RIGHT],
    nw:                   [ACTIONS.MOVE_FORWARD, ACTIONS.STRAFE_LEFT],
    ne:                   [ACTIONS.MOVE_FORWARD, ACTIONS.STRAFE_RIGHT],
    sw:                   [ACTIONS.MOVE_BACKWARD, ACTIONS.STRAFE_LEFT],
    se:                   [ACTIONS.MOVE_BACKWARD, ACTIONS.STRAFE_RIGHT],
    turn_left:            [ACTIONS.TURN_LEFT],
    action_turn_left:     [ACTIONS.TURN_LEFT],
    turn_right:           [ACTIONS.TURN_RIGHT],
    action_turn_right:    [ACTIONS.TURN_RIGHT]
  };

  var boundActions = Object.assign(
    { Q: null, E: null, R: null },
    VERMIS.hotkeys || {}
  );

  function InputController() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.keyBindings = {};
    this.activeActions = new Set();
    this.listeners = {};

    this.moveVector = { dx: 0, dy: 0, octant: 'CENTER', magnitude: 0 };
    this.cameraDelta = { x: 0, y: 0 };
    this.mouseDeltaX = 0;

    this.awaitingRemapAction = null;
    this.swingStart = null;
    this.lastStrikeDirection = null;

    // Virtual Gamepad Layout Editor state
    this.vpadEditMode = false;
    this.vpadSnapToGrid = true; // true = 12px Grid-Snap, false = Free-Move
    this.vpadGridSize = 12;
    this.selectedVpadWidget = null;
    this.vpadLayout = {};
    this.vpadDefaults = {};

    this.syncInputBridge();
    this._initKeyboardAndMouse();
    this._initMobileTouchDeck();
    this._initVpadLayoutEditor();
    this._initShellTogglesAndRemapper();
    this._initModularHotkeyDOM();
  }

  /**
   * Public method to set/clear an action inside activeActions and immediately sync
   * flat boolean flags so syncInputBridge() never wipes virtual button presses.
   * @param {string} actionName
   * @param {boolean} isPressed
   */
  InputController.prototype.setActionState = function (actionName, isPressed) {
    if (!actionName) return;
    var wasActive = this.activeActions.has(actionName);

    if (isPressed) {
      this.activeActions.add(actionName);
      this[actionName] = true;
      if (!wasActive) {
        this._emit(actionName, { state: 'pressed', source: 'virtual' });
        this._handleDiscreteAction(actionName);
      }
    } else {
      this.activeActions.delete(actionName);
      this[actionName] = false;
      if (wasActive) {
        this._emit(actionName, { state: 'released', source: 'virtual' });
      }
    }

    this._recomputeActive8WayVector();
    this.syncInputBridge();
  };

  /**
   * Synchronizes flat boolean flags (inp.ACTION_MOVE_FORWARD, etc.) and keyBindings
   * from this.activeActions and this.moveVector for raycaster.js and index.html.
   */
  InputController.prototype.syncInputBridge = function () {
    var actionKeys = Object.keys(ACTIONS);
    for (var i = 0; i < actionKeys.length; i++) {
      var act = ACTIONS[actionKeys[i]];
      this[act] = this.activeActions.has(act);
    }

    if (this.moveVector.dy < 0) this.ACTION_MOVE_FORWARD = true;
    if (this.moveVector.dy > 0) this.ACTION_MOVE_BACKWARD = true;
    if (this.moveVector.dx < 0) this.ACTION_STRAFE_LEFT = true;
    if (this.moveVector.dx > 0) this.ACTION_STRAFE_RIGHT = true;

    var bindKeys = Object.keys(this.bindings);
    for (var j = 0; j < bindKeys.length; j++) {
      var bAct = bindKeys[j];
      this.keyBindings[bAct] = this.bindings[bAct].label;
    }
    this.keyBindings.ACTION_LOUPE_HOLD = this.bindings.ACTION_LOUPE.label;
  };

  InputController.prototype.snapTo8WayGrid = function (rawX, rawY, deadzone) {
    var dz = typeof deadzone === 'number' ? deadzone : 0.28;
    var mag = Math.hypot(rawX, rawY);
    if (mag < dz) {
      return { dx: 0, dy: 0, octant: 'CENTER', magnitude: 0 };
    }
    var theta = Math.atan2(rawY, rawX);
    var sector = Math.round(theta / (Math.PI / 4));
    var normalizedIndex = ((sector % 8) + 8) % 8;
    var snapped = EIGHT_WAY_DIRS[normalizedIndex];
    return {
      dx: snapped.dx,
      dy: snapped.dy,
      octant: snapped.name,
      magnitude: 1.0
    };
  };

  InputController.prototype._recomputeActive8WayVector = function () {
    var x = 0;
    var y = 0;
    if (this.activeActions.has(ACTIONS.STRAFE_LEFT))  x -= 1;
    if (this.activeActions.has(ACTIONS.STRAFE_RIGHT)) x += 1;
    if (this.activeActions.has(ACTIONS.MOVE_FORWARD))  y -= 1;
    if (this.activeActions.has(ACTIONS.MOVE_BACKWARD)) y += 1;

    this.moveVector = this.snapTo8WayGrid(x, y, 0.1);
  };

  // ==========================================================================
  // 1. KEYBOARD, MOUSE & DAGGERFALL STRIKE VECTORS
  // ==========================================================================
  InputController.prototype._initKeyboardAndMouse = function () {
    var self = this;

    window.addEventListener('keydown', function (e) {
      if (self.awaitingRemapAction) {
        e.preventDefault();
        self._completeRemap(self.awaitingRemapAction, {
          key: e.code,
          label: e.key.length === 1 ? e.key.toUpperCase() : e.code.replace('Key', '')
        });
        return;
      }

      if (e.code === 'KeyK' && !e.repeat) {
        self.renderRemapModalList();
      }

      var matchedAction = self._findActionByKey(e.code);
      if (matchedAction) {
        self.setActionState(matchedAction, true);
      }
    });

    window.addEventListener('keyup', function (e) {
      var matchedAction = self._findActionByKey(e.code);
      if (matchedAction) {
        self.setActionState(matchedAction, false);
      }
    });

    var stage =
      document.getElementById('visual-stage-canvas') ||
      document.getElementById('displayCanvas');
    if (stage) {
      stage.addEventListener('pointerdown', function (e) {
        if (self.awaitingRemapAction) {
          e.preventDefault();
          self._completeRemap(self.awaitingRemapAction, {
            key: 'Mouse' + e.button,
            label: 'MOUSE_' + e.button
          });
          return;
        }
        if (e.button === 0 && !self.isActionActive(ACTIONS.LOUPE)) {
          self.swingStart = { x: e.clientX, y: e.clientY, time: performance.now() };
          self.setActionState(ACTIONS.ATTACK, true);
        }
      });

      window.addEventListener('pointerup', function (e) {
        if (self.swingStart) {
          var dx = e.clientX - self.swingStart.x;
          var dy = e.clientY - self.swingStart.y;
          var dist = Math.hypot(dx, dy);

          if (dist >= 16) {
            var snap = self.snapTo8WayGrid(dx, dy, 0.1);
            self.lastStrikeDirection = snap.octant;
            self._emit(ACTIONS.ATTACK, {
              state: 'strike',
              direction: snap.octant,
              vector: { dx: snap.dx, dy: snap.dy },
              source: 'pointer_drag'
            });
            self._logToTerminal('STRIKE VECTOR EXECUTED: [' + snap.octant + ' SLASH]');
          }
          self.swingStart = null;
          self.setActionState(ACTIONS.ATTACK, false);
        }
      });
    }
  };

  // ==========================================================================
  // 2. 2DS MOBILE TOUCH DECK ([data-dpad], TURN L/R, & #touch-pad-left 8-WAY)
  // ==========================================================================
  InputController.prototype._initMobileTouchDeck = function () {
    var self = this;

    // A. Wire all [data-dpad] buttons via setActionState()
    var dpadButtons = document.querySelectorAll('[data-dpad]');
    for (var i = 0; i < dpadButtons.length; i++) {
      (function (btn) {
        var rawToken = (btn.getAttribute('data-dpad') || '').toLowerCase();
        var mappedActions = DPAD_MAP[rawToken] || [btn.getAttribute('data-dpad')];

        var pressHandler = function (e) {
          if (self.vpadEditMode) return;
          e.preventDefault();
          if (btn.setPointerCapture && e.pointerId !== undefined) {
            try { btn.setPointerCapture(e.pointerId); } catch (_) {}
          }
          btn.classList.add('active');
          for (var k = 0; k < mappedActions.length; k++) {
            self.setActionState(mappedActions[k], true);
          }
        };

        var releaseHandler = function (e) {
          if (e) e.preventDefault();
          btn.classList.remove('active');
          for (var k = 0; k < mappedActions.length; k++) {
            self.setActionState(mappedActions[k], false);
          }
        };

        btn.addEventListener('pointerdown', pressHandler);
        btn.addEventListener('pointerup', releaseHandler);
        btn.addEventListener('pointercancel', releaseHandler);
        btn.addEventListener('pointerleave', function (e) {
          if (btn.classList.contains('active')) releaseHandler(e);
        });
      })(dpadButtons[i]);
    }

    // B. Wire #btn-touch-turn-l and #btn-touch-turn-r via setActionState()
    var bindHoldButton = function (id, actionName) {
      var el = document.getElementById(id);
      if (!el) return;

      var onDown = function (e) {
        if (self.vpadEditMode) return;
        e.preventDefault();
        if (el.setPointerCapture && e.pointerId !== undefined) {
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
        }
        el.classList.add('active');
        self.setActionState(actionName, true);
      };

      var onUp = function (e) {
        if (e) e.preventDefault();
        el.classList.remove('active');
        self.setActionState(actionName, false);
      };

      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', function (e) {
        if (el.classList.contains('active')) onUp(e);
      });
    };

    bindHoldButton('btn-touch-turn-l', ACTIONS.TURN_LEFT);
    bindHoldButton('btn-touch-turn-r', ACTIONS.TURN_RIGHT);
    bindHoldButton('btn-touch-attack', ACTIONS.ATTACK);

    // C. Wire 8-Way Drag Surface (#touch-pad-left, #touch-left-stick, #touch-stick-move)
    var padSurfaces = [
      document.getElementById('touch-pad-left'),
      document.getElementById('touch-left-stick'),
      document.getElementById('touch-stick-move')
    ];

    var stickNub = document.getElementById('touch-stick-nub');
    var octantReadout = document.getElementById('touch-octant-readout');

    for (var s = 0; s < padSurfaces.length; s++) {
      var surface = padSurfaces[s];
      if (!surface || surface.dataset.vermisPadBound === 'true') continue;
      surface.dataset.vermisPadBound = 'true';

      (function (zone) {
        var originX = 0;
        var originY = 0;
        var activePointerId = null;
        var maxRadius = 36;

        zone.addEventListener('pointerdown', function (e) {
          if (self.vpadEditMode) return;
          e.preventDefault();
          activePointerId = e.pointerId;
          if (zone.setPointerCapture) {
            try { zone.setPointerCapture(e.pointerId); } catch (_) {}
          }
          var rect = zone.getBoundingClientRect();
          originX = rect.left + rect.width * 0.5;
          originY = rect.top + rect.height * 0.5;
          self._apply8WayTouchPadDelta(
            e.clientX - originX,
            e.clientY - originY,
            maxRadius,
            stickNub,
            octantReadout
          );
        });

        zone.addEventListener('pointermove', function (e) {
          if (self.vpadEditMode || e.pointerId !== activePointerId) return;
          e.preventDefault();
          self._apply8WayTouchPadDelta(
            e.clientX - originX,
            e.clientY - originY,
            maxRadius,
            stickNub,
            octantReadout
          );
        });

        var resetPad = function (e) {
          if (e && activePointerId !== null && e.pointerId !== activePointerId) return;
          activePointerId = null;
          self._clear8WayTouchPadActions(stickNub, octantReadout);
        };

        zone.addEventListener('pointerup', resetPad);
        zone.addEventListener('pointercancel', resetPad);
      })(surface);
    }

    // D. Wire Right Thumb Camera Swipe Zone (#touch-right-look, #touch-swipe-look, #touch-pad-right)
    var lookZones = [
      document.getElementById('touch-right-look'),
      document.getElementById('touch-swipe-look'),
      document.getElementById('touch-pad-right')
    ];

    for (var lz = 0; lz < lookZones.length; lz++) {
      var lookZone = lookZones[lz];
      if (!lookZone || lookZone.dataset.vermisLookBound === 'true') continue;
      lookZone.dataset.vermisLookBound = 'true';

      (function (zone) {
        var lastX = null;
        zone.addEventListener('pointerdown', function (e) {
          if (self.vpadEditMode) return;
          lastX = e.clientX;
          if (zone.setPointerCapture) {
            try { zone.setPointerCapture(e.pointerId); } catch (_) {}
          }
        });

        zone.addEventListener('pointermove', function (e) {
          if (self.vpadEditMode || lastX === null) return;
          var dx = e.clientX - lastX;
          lastX = e.clientX;
          self.cameraDelta.x = dx;
          self.mouseDeltaX += dx * 2.2;
        });

        var endLook = function () {
          lastX = null;
          self.cameraDelta.x = 0;
        };
        zone.addEventListener('pointerup', endLook);
        zone.addEventListener('pointercancel', endLook);
      })(lookZone);
    }
  };

  /**
   * Routes 8-way drag surface deltas through setActionState() so activeActions
   * and syncInputBridge() stay locked in sync.
   */
  InputController.prototype._apply8WayTouchPadDelta = function (
    dx,
    dy,
    maxRadius,
    stickNub,
    octantReadout
  ) {
    var normX = Math.max(-1, Math.min(1, dx / maxRadius));
    var normY = Math.max(-1, Math.min(1, dy / maxRadius));
    var snapped = this.snapTo8WayGrid(normX, normY, 0.22);

    this.setActionState(ACTIONS.MOVE_FORWARD,  snapped.dy < 0);
    this.setActionState(ACTIONS.MOVE_BACKWARD, snapped.dy > 0);
    this.setActionState(ACTIONS.STRAFE_LEFT,   snapped.dx < 0);
    this.setActionState(ACTIONS.STRAFE_RIGHT,  snapped.dx > 0);
    this.moveVector = snapped;

    if (stickNub) {
      var snapPxX = snapped.dx * (maxRadius * 0.72);
      var snapPxY = snapped.dy * (maxRadius * 0.72);
      stickNub.style.transform = 'translate(' + snapPxX + 'px, ' + snapPxY + 'px)';
    }
    if (octantReadout) {
      octantReadout.textContent = '8-WAY: ' + snapped.octant;
    }
    this.syncInputBridge();
  };

  InputController.prototype._clear8WayTouchPadActions = function (stickNub, octantReadout) {
    this.setActionState(ACTIONS.MOVE_FORWARD,  false);
    this.setActionState(ACTIONS.MOVE_BACKWARD, false);
    this.setActionState(ACTIONS.STRAFE_LEFT,   false);
    this.setActionState(ACTIONS.STRAFE_RIGHT,  false);
    this.moveVector = { dx: 0, dy: 0, octant: 'CENTER', magnitude: 0 };

    if (stickNub) stickNub.style.transform = 'translate(0px, 0px)';
    if (octantReadout) octantReadout.textContent = '8-WAY: CENTER';
    this.syncInputBridge();
  };

  // ==========================================================================
  // 3. VIRTUAL GAMEPAD LAYOUT EDITOR (.vpad-widget in #mobile-touch-deck)
  // ==========================================================================
  InputController.prototype._initVpadLayoutEditor = function () {
    var self = this;
    var deck = document.getElementById('mobile-touch-deck');
    if (!deck) return;

    var widgets = deck.querySelectorAll('.vpad-widget');
    for (var i = 0; i < widgets.length; i++) {
      var w = widgets[i];
      var wid = this._getVpadWidgetId(w, i);
      this.vpadDefaults[wid] = {
        left: w.style.left || '',
        top: w.style.top || '',
        right: w.style.right || '',
        bottom: w.style.bottom || '',
        transform: w.style.transform || ''
      };
      this._bindVpadWidgetDrag(w, wid, deck);
    }

    // Load persisted layout from localStorage (VERMIS_PAD_LAYOUT_V1)
    this.loadVpadLayout();

    // Wire #btn-edit-vpad toggle (plus optional #btn-vpad-done close button)
    var btnEditVpad = document.getElementById('btn-edit-vpad');
    if (btnEditVpad) {
      btnEditVpad.addEventListener('click', function () {
        self.toggleVpadEditMode();
      });
    }

    var btnVpadDone = document.getElementById('btn-vpad-done');
    if (btnVpadDone) {
      btnVpadDone.addEventListener('click', function () {
        if (self.vpadEditMode) self.toggleVpadEditMode(false);
      });
    }

    // Wire #btn-vpad-snap (Free-Move vs. 12px Grid-Snap)
    var btnSnap = document.getElementById('btn-vpad-snap');
    if (btnSnap) {
      btnSnap.addEventListener('click', function () {
        self.vpadSnapToGrid = !self.vpadSnapToGrid;
        btnSnap.classList.toggle('active', self.vpadSnapToGrid);
        btnSnap.textContent = self.vpadSnapToGrid ? 'SNAP: 12PX' : 'SNAP: FREE';
      });
    }

    // Wire #vpad-item-scale slider (50% - 160% independent per-button size scaling)
    var scaleSlider = document.getElementById('vpad-item-scale');
    if (scaleSlider) {
      scaleSlider.addEventListener('input', function (e) {
        var pct = Math.max(50, Math.min(160, parseInt(e.target.value, 10) || 100));
        self.setSelectedVpadWidgetScale(pct / 100);
      });
    }

    // Wire #btn-vpad-reset
    var btnReset = document.getElementById('btn-vpad-reset');
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        self.resetVpadLayout();
      });
    }
  };

  InputController.prototype._getVpadWidgetId = function (el, fallbackIndex) {
    return (
      el.getAttribute('data-vpad-id') ||
      el.getAttribute('data-pad-widget') ||
      el.id ||
      'vpad_widget_' + fallbackIndex
    );
  };

  InputController.prototype.toggleVpadEditMode = function (forceState) {
    this.vpadEditMode =
      typeof forceState === 'boolean' ? forceState : !this.vpadEditMode;

    var deck = document.getElementById('mobile-touch-deck');
    var editorBar =
      document.getElementById('vpad-editor-bar') ||
      document.getElementById('pad-editor-toolbar');
    var btnEdit = document.getElementById('btn-edit-vpad');

    // Clear any held movement actions when entering Edit Mode
    if (this.vpadEditMode) {
      this._clear8WayTouchPadActions();
    }

    if (deck) {
      deck.classList.toggle('vpad-edit-active', this.vpadEditMode);
    }
    if (editorBar) {
      editorBar.hidden = !this.vpadEditMode;
    }
    if (btnEdit) {
      btnEdit.classList.toggle('active', this.vpadEditMode);
      btnEdit.textContent = this.vpadEditMode ? 'EDIT PAD: ON' : 'EDIT PAD';
    }

    if (!this.vpadEditMode) {
      this._clearVpadSelection();
      this.saveVpadLayout();
    } else {
      // Auto-select the first .vpad-widget if none is selected
      var firstWidget = deck ? deck.querySelector('.vpad-widget') : null;
      if (firstWidget && !this.selectedVpadWidget) {
        this.selectVpadWidget(firstWidget);
      }
    }
  };

  InputController.prototype.selectVpadWidget = function (widgetEl) {
    var deck = document.getElementById('mobile-touch-deck');
    if (!deck || !widgetEl) return;

    var all = deck.querySelectorAll('.vpad-widget');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.remove('vpad-selected');
    }

    widgetEl.classList.add('vpad-selected');
    this.selectedVpadWidget = widgetEl;

    var wid = this._getVpadWidgetId(widgetEl, 0);
    var saved = this.vpadLayout[wid];
    var currentScale = saved && typeof saved.scale === 'number' ? saved.scale : 1.0;
    var pct = Math.round(currentScale * 100);

    var scaleSlider = document.getElementById('vpad-item-scale');
    if (scaleSlider) scaleSlider.value = String(pct);

    var scaleLabel = document.getElementById('vpad-scale-val');
    if (scaleLabel) scaleLabel.textContent = pct + '%';
  };

  InputController.prototype._clearVpadSelection = function () {
    var deck = document.getElementById('mobile-touch-deck');
    if (!deck) return;
    var all = deck.querySelectorAll('.vpad-widget');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.remove('vpad-selected');
    }
    this.selectedVpadWidget = null;
  };

  InputController.prototype.setSelectedVpadWidgetScale = function (scaleFactor) {
    if (!this.selectedVpadWidget) return;
    var clamped = Math.max(0.5, Math.min(1.6, scaleFactor));
    var wid = this._getVpadWidgetId(this.selectedVpadWidget, 0);

    if (!this.vpadLayout[wid]) {
      var deck = document.getElementById('mobile-touch-deck');
      var dRect = deck.getBoundingClientRect();
      var wRect = this.selectedVpadWidget.getBoundingClientRect();
      this.vpadLayout[wid] = {
        x: Math.round(wRect.left - dRect.left),
        y: Math.round(wRect.top - dRect.top),
        scale: clamped
      };
    } else {
      this.vpadLayout[wid].scale = clamped;
    }

    this._applyWidgetTransform(this.selectedVpadWidget, this.vpadLayout[wid]);

    var scaleLabel = document.getElementById('vpad-scale-val');
    if (scaleLabel) {
      scaleLabel.textContent = Math.round(clamped * 100) + '%';
    }

    this.saveVpadLayout();
  };

  InputController.prototype._bindVpadWidgetDrag = function (widgetEl, wid, deck) {
    var self = this;
    var isDragging = false;
    var pointerId = null;
    var startOffsetX = 0;
    var startOffsetY = 0;

    widgetEl.addEventListener(
      'pointerdown',
      function (e) {
        if (!self.vpadEditMode) return;
        e.preventDefault();
        e.stopPropagation();

        self.selectVpadWidget(widgetEl);
        isDragging = true;
        pointerId = e.pointerId;

        if (widgetEl.setPointerCapture) {
          try { widgetEl.setPointerCapture(e.pointerId); } catch (_) {}
        }

        var wRect = widgetEl.getBoundingClientRect();
        startOffsetX = e.clientX - wRect.left;
        startOffsetY = e.clientY - wRect.top;
      },
      true
    );

    widgetEl.addEventListener(
      'pointermove',
      function (e) {
        if (!self.vpadEditMode || !isDragging || e.pointerId !== pointerId) return;
        e.preventDefault();
        e.stopPropagation();

        var dRect = deck.getBoundingClientRect();
        var wRect = widgetEl.getBoundingClientRect();

        var rawX = e.clientX - dRect.left - startOffsetX;
        var rawY = e.clientY - dRect.top - startOffsetY;

        if (self.vpadSnapToGrid) {
          var g = self.vpadGridSize || 12;
          rawX = Math.round(rawX / g) * g;
          rawY = Math.round(rawY / g) * g;
        } else {
          rawX = Math.round(rawX);
          rawY = Math.round(rawY);
        }

        var maxX = Math.max(0, dRect.width - wRect.width);
        var maxY = Math.max(0, dRect.height - wRect.height);

        var clampedX = Math.max(0, Math.min(maxX, rawX));
        var clampedY = Math.max(0, Math.min(maxY, rawY));

        var prevScale =
          self.vpadLayout[wid] && typeof self.vpadLayout[wid].scale === 'number'
            ? self.vpadLayout[wid].scale
            : 1.0;

        self.vpadLayout[wid] = {
          x: clampedX,
          y: clampedY,
          scale: prevScale
        };

        self._applyWidgetTransform(widgetEl, self.vpadLayout[wid]);
      },
      true
    );

    var endDrag = function (e) {
      if (!isDragging || (e && e.pointerId !== pointerId)) return;
      isDragging = false;
      if (widgetEl.releasePointerCapture && pointerId !== null) {
        try { widgetEl.releasePointerCapture(pointerId); } catch (_) {}
      }
      pointerId = null;
      self.saveVpadLayout();
    };

    widgetEl.addEventListener('pointerup', endDrag, true);
    widgetEl.addEventListener('pointercancel', endDrag, true);
  };

  InputController.prototype._applyWidgetTransform = function (widgetEl, cfg) {
    if (!widgetEl || !cfg) return;
    widgetEl.style.position = 'absolute';
    widgetEl.style.left = Math.round(cfg.x) + 'px';
    widgetEl.style.top = Math.round(cfg.y) + 'px';
    widgetEl.style.right = 'auto';
    widgetEl.style.bottom = 'auto';
    widgetEl.style.transformOrigin = 'top left';
    widgetEl.style.transform = 'scale(' + (cfg.scale || 1.0) + ')';
  };

  InputController.prototype.saveVpadLayout = function () {
    try {
      localStorage.setItem(STORAGE_KEY_VPAD, JSON.stringify(this.vpadLayout));
    } catch (_) {}
  };

  InputController.prototype.loadVpadLayout = function () {
    var deck = document.getElementById('mobile-touch-deck');
    if (!deck) return;

    try {
      var raw = localStorage.getItem(STORAGE_KEY_VPAD);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      this.vpadLayout = parsed;
      var widgets = deck.querySelectorAll('.vpad-widget');
      for (var i = 0; i < widgets.length; i++) {
        var wid = this._getVpadWidgetId(widgets[i], i);
        if (this.vpadLayout[wid]) {
          this._applyWidgetTransform(widgets[i], this.vpadLayout[wid]);
        }
      }
    } catch (_) {}
  };

  InputController.prototype.resetVpadLayout = function () {
    var deck = document.getElementById('mobile-touch-deck');
    this.vpadLayout = {};
    try {
      localStorage.removeItem(STORAGE_KEY_VPAD);
    } catch (_) {}

    if (deck) {
      var widgets = deck.querySelectorAll('.vpad-widget');
      for (var i = 0; i < widgets.length; i++) {
        var w = widgets[i];
        var wid = this._getVpadWidgetId(w, i);
        var def = this.vpadDefaults[wid] || {};
        w.style.left = def.left || '';
        w.style.top = def.top || '';
        w.style.right = def.right || '';
        w.style.bottom = def.bottom || '';
        w.style.transform = def.transform || '';
      }
    }

    var scaleSlider = document.getElementById('vpad-item-scale');
    if (scaleSlider) scaleSlider.value = '100';
    var scaleLabel = document.getElementById('vpad-scale-val');
    if (scaleLabel) scaleLabel.textContent = '100%';

    this._logToTerminal('VIRTUAL GAMEPAD LAYOUT RESET TO DEFAULT.');
  };

  // ==========================================================================
  // 4. SHELL TOGGLES, GAMEPAD POLLING, HOTKEYS & TERMINAL REMAPPER
  // ==========================================================================
  InputController.prototype._initShellTogglesAndRemapper = function () {
    var self = this;

    var btnTouchDeck = document.getElementById('btn-touch-deck');
    var mobileDeck = document.getElementById('mobile-touch-deck');
    if (btnTouchDeck && mobileDeck) {
      btnTouchDeck.addEventListener('click', function () {
        VERMIS.Config.touchDeckEnabled = !VERMIS.Config.touchDeckEnabled;
        mobileDeck.hidden = !VERMIS.Config.touchDeckEnabled;
        btnTouchDeck.classList.toggle('active', VERMIS.Config.touchDeckEnabled);
        btnTouchDeck.textContent =
          'TOUCH: ' + (VERMIS.Config.touchDeckEnabled ? 'ON' : 'OFF');
      });
    }

    var btnLoupe = document.getElementById('btn-loupe');
    var btnTouchLoupe = document.getElementById('btn-touch-loupe');
    var loupeInset = document.getElementById('loupe-inset');
    var toggleLoupe = function () {
      if (self.vpadEditMode) return;
      VERMIS.Config.loupeEnabled = !VERMIS.Config.loupeEnabled;
      if (loupeInset) loupeInset.hidden = !VERMIS.Config.loupeEnabled;
      if (btnLoupe) {
        btnLoupe.classList.toggle('active', VERMIS.Config.loupeEnabled);
        btnLoupe.textContent =
          'LOUPE: ' + (VERMIS.Config.loupeEnabled ? 'ON' : 'OFF');
      }
      if (VERMIS.Config.loupeEnabled && VERMIS.Shader) {
        VERMIS.Shader.renderLoupePass(160, 200);
      }
    };
    if (btnLoupe) btnLoupe.addEventListener('click', toggleLoupe);
    if (btnTouchLoupe) btnTouchLoupe.addEventListener('click', toggleLoupe);

    var btnRemap = document.getElementById('btn-remap');
    if (btnRemap) {
      btnRemap.addEventListener('click', function () {
        setTimeout(function () {
          self.renderRemapModalList();
        }, 20);
      });
    }
  };

  InputController.prototype.renderRemapModalList = function () {
    var self = this;
    var rl = document.getElementById('remap-list');
    if (!rl) return;
    rl.innerHTML = '';

    var keys = Object.keys(this.bindings);
    for (var i = 0; i < keys.length; i++) {
      (function (actionName) {
        var cfg = self.bindings[actionName];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'remap-row';

        var span = document.createElement('span');
        span.textContent = actionName;
        var strong = document.createElement('strong');
        strong.textContent = '[' + cfg.label + ']';

        b.appendChild(span);
        b.appendChild(strong);
        b.addEventListener('click', function () {
          self.promptRemap(actionName);
        });
        rl.appendChild(b);
      })(keys[i]);
    }
  };

  InputController.prototype.pollGamepad = function () {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var pad = pads[0];
    if (!pad) return;

    if (this.awaitingRemapAction) {
      for (var b = 0; b < pad.buttons.length; b++) {
        if (pad.buttons[b].pressed) {
          this._completeRemap(this.awaitingRemapAction, {
            gamepadBtn: b,
            label: 'PAD_BTN_' + b
          });
          return;
        }
      }
    }

    var lx = pad.axes[0] || 0;
    var ly = pad.axes[1] || 0;
    var padMove = this.snapTo8WayGrid(lx, ly, 0.28);
    if (padMove.octant !== 'CENTER') {
      this.moveVector = padMove;
    }

    var rx = pad.axes[2] || 0;
    var ry = pad.axes[3] || 0;
    var ltHeld = pad.buttons[6] && pad.buttons[6].pressed;

    if (ltHeld) {
      this.activeActions.add(ACTIONS.LOUPE);
      if (VERMIS.UIDragger && typeof VERMIS.UIDragger.nudgeLoupeByStick === 'function') {
        VERMIS.UIDragger.nudgeLoupeByStick(rx * 5.5, ry * 5.5);
      }
    } else if (Math.hypot(rx, ry) > 0.22) {
      this.cameraDelta.x = rx * 4.0;
      this.mouseDeltaX += rx * 4.0;
    }

    var bindKeys = Object.keys(this.bindings);
    for (var i = 0; i < bindKeys.length; i++) {
      var actionName = bindKeys[i];
      var cfg = this.bindings[actionName];
      if (cfg.gamepadBtn !== null && pad.buttons[cfg.gamepadBtn]) {
        var isDown = pad.buttons[cfg.gamepadBtn].pressed;
        var wasDown = this.activeActions.has(actionName);
        if (isDown && !wasDown) {
          this.setActionState(actionName, true);
        } else if (!isDown && wasDown && actionName !== ACTIONS.LOUPE) {
          this.setActionState(actionName, false);
        }
      }
    }

    this.syncInputBridge();
  };

  InputController.prototype.bindHotkey = function (slotKey, actionPayload) {
    var slot = String(slotKey || '').toUpperCase();
    if (!(slot in boundActions)) return false;
    boundActions[slot] = actionPayload;
    this._syncHotkeyDOM(slot);
    return true;
  };

  InputController.prototype.triggerHotkey = function (slotKey) {
    if (this.vpadEditMode) return false;
    var slot = String(slotKey || '').toUpperCase();
    var entry = boundActions[slot];
    if (!entry) {
      this._logToTerminal('HOTKEY [' + slot + ']: EMPTY SLOT (NO DISTINCTION OR SALVE BOUND).');
      return false;
    }
    this._logToTerminal('INVOKING [' + slot + '] -> ' + entry.name.toUpperCase());
    if (typeof entry.execute === 'function') {
      entry.execute();
    }
    return true;
  };

  InputController.prototype._initModularHotkeyDOM = function () {
    var self = this;
    var slots = ['Q', 'E'];
    for (var i = 0; i < slots.length; i++) {
      (function (slot) {
        var btn =
          document.getElementById('hotkey-slot-' + slot.toLowerCase()) ||
          document.getElementById('btn-hotkey-' + slot.toLowerCase());
        if (btn) {
          btn.addEventListener('click', function () {
            self.triggerHotkey(slot);
          });
        }
        self._syncHotkeyDOM(slot);
      })(slots[i]);
    }
  };

  InputController.prototype._syncHotkeyDOM = function (slot) {
    var btn =
      document.getElementById('hotkey-slot-' + slot.toLowerCase()) ||
      document.getElementById('btn-hotkey-' + slot.toLowerCase());
    if (!btn) return;
    var entry = boundActions[slot];
    btn.textContent = entry ? '[' + slot + '] ' + entry.name.toUpperCase() : '[' + slot + '] --EMPTY--';
  };

  InputController.prototype.promptRemap = function (actionName) {
    if (!this.bindings[actionName]) return;
    this.awaitingRemapAction = actionName;
    var promptEl = document.getElementById('remap-prompt');
    if (promptEl) {
      promptEl.textContent =
        'AWAITING INPUT FOR [' + actionName + ']... (PRESS KEY, MOUSE, OR TRIGGER)';
    }
    this._logToTerminal('REMAP [' + actionName + ']: AWAITING INPUT...');
  };

  InputController.prototype._completeRemap = function (actionName, newBind) {
    Object.assign(this.bindings[actionName], newBind);
    this.awaitingRemapAction = null;
    this.syncInputBridge();
    this.renderRemapModalList();
    var promptEl = document.getElementById('remap-prompt');
    if (promptEl) {
      promptEl.textContent =
        'STATUS: BOUND [' + actionName + '] -> [' + this.bindings[actionName].label + ']';
    }
    this._logToTerminal('BOUND [' + actionName + '] -> [' + this.bindings[actionName].label + ']');
  };

  InputController.prototype._handleDiscreteAction = function (actionName) {
    if (actionName === ACTIONS.HOTKEY_Q) this.triggerHotkey('Q');
    else if (actionName === ACTIONS.HOTKEY_E) this.triggerHotkey('E');
    else if (actionName.indexOf('ACTION_CHOICE_') === 0) {
      var choiceNum = actionName.replace('ACTION_CHOICE_', '');
      var choiceEl = document.querySelector('[data-choice="' + choiceNum + '"]');
      if (choiceEl && !choiceEl.closest('[hidden]')) choiceEl.click();
    }
  };

  InputController.prototype._findActionByKey = function (keyCode) {
    var keys = Object.keys(this.bindings);
    for (var i = 0; i < keys.length; i++) {
      var act = keys[i];
      if (this.bindings[act].key === keyCode) return act;
    }
    return null;
  };

  InputController.prototype.isActionActive = function (actionName) {
    return this.activeActions.has(actionName);
  };

  InputController.prototype.on = function (actionName, callback) {
    this.listeners[actionName] = this.listeners[actionName] || [];
    this.listeners[actionName].push(callback);
  };

  InputController.prototype._emit = function (actionName, payload) {
    var list = this.listeners[actionName];
    if (list) {
      for (var i = 0; i < list.length; i++) {
        list[i](payload);
      }
    }
  };

  InputController.prototype._logToTerminal = function (msg) {
    if (VERMIS.UI && typeof VERMIS.UI.logTelemetry === 'function') {
      VERMIS.UI.logTelemetry(msg, false);
      return;
    }
    if (typeof VERMIS.logTelemetry === 'function') {
      VERMIS.logTelemetry(msg);
      return;
    }
    var deck = document.getElementById('rolling-telemetry-deck');
    if (!deck) return;
    var line = document.createElement('div');
    line.className = 'log-entry';
    line.textContent = '> ' + msg;
    deck.appendChild(line);
    deck.scrollTop = deck.scrollHeight;
  };

  VERMIS.ACTIONS = ACTIONS;
  VERMIS.hotkeys = boundActions;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      VERMIS.inputMap = new InputController();
    });
  } else {
    VERMIS.inputMap = new InputController();
  }
})();

