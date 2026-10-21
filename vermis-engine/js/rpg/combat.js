/* ============================================================================
   VERMIS // MODULE 03 & 03.2: RTwP COMBAT, AUTO-PAUSE & STRICT #choice-deck GATE
   File Address: vermis-engine/js/rpg/combat.js
   Version: v1.5.2
   Implements: Strict #choice-deck Initialization Gate (hidden = true unless
               V.State.mode === 'AUTO_PAUSE'), Dual-Layer Re-Entrancy Locks,
               and Solace <-> Malignancy 1:1 Transfers
   ============================================================================ */

window.VERMIS = window.VERMIS || {};

(function () {
  'use strict';

  var V = window.VERMIS;

  var recoveryState = {
    cooldown: 0,
    maxCooldown: 0.55,
    activeEnemy: null,
    activeThreatTN: 10
  };

  function logCombat(msg, isAlert) {
    if (V.UI && typeof V.UI.logTelemetry === 'function') {
      V.UI.logTelemetry(msg, Boolean(isAlert));
    } else if (V.UI && typeof V.UI.log === 'function') {
      V.UI.log(msg, Boolean(isAlert));
    } else if (typeof V.logTelemetry === 'function') {
      V.logTelemetry(msg, Boolean(isAlert));
    }
  }

  function getDifficultyMultiplier() {
    if (V.Settings && typeof V.Settings.getDifficultyMultiplier === 'function') {
      return V.Settings.getDifficultyMultiplier();
    }
    var diff = (V.Config && V.Config.difficulty) || 'UNFORGIVING';
    return diff === 'DOOMED' ? 2.0 : diff === 'MISERABLE' ? 1.5 : 1.0;
  }

  function getRotTierPenalty() {
    if (V.Shader && typeof V.Shader.getRotTNPenalty === 'function') {
      return V.Shader.getRotTNPenalty();
    }
    var rot = (V.State && V.State.rotTier) || 1;
    return rot >= 4 ? 2 : 0;
  }

  /**
   * Requirement 3: Strictly enforces #choice-deck hidden = true unless V.State.mode === 'AUTO_PAUSE'
   */
  function syncChoiceDeckVisibility() {
    var choiceDeck = document.getElementById('choice-deck');
    if (!choiceDeck) return;

    var isAutoPause =
      Boolean(V.State) &&
      V.State.mode === 'AUTO_PAUSE' &&
      (V.State.currentPhase === 'AUTO_PAUSE' || V.State.currentPhase === 'SPATIAL_HUNT');

    if (isAutoPause) {
      choiceDeck.hidden = false;
      choiceDeck.style.display = '';
      choiceDeck.style.pointerEvents = V.State.isProcessingChoice ? 'none' : 'auto';
    } else {
      choiceDeck.hidden = true;
      choiceDeck.style.display = 'none';
      choiceDeck.style.pointerEvents = 'none';
    }
  }

  V.Combat = {
    initialize: function () {
      // Force #choice-deck strictly hidden on boot/initialization
      if (V.State && V.State.mode !== 'AUTO_PAUSE') {
        V.State.isProcessingChoice = false;
      }
      syncChoiceDeckVisibility();
      this.bindCombatTriggers();
    },

    syncChoiceDeckVisibility: syncChoiceDeckVisibility,

    getWeaponMetrics: function () {
      var brawn = V.Character ? V.Character.getEffectiveStat('brawn') : 4;
      var inAdrenaline = V.Character && V.Character.isInAdrenaline();
      var swingDuration = inAdrenaline
        ? 0.22
        : Math.max(0.26, 0.70 - brawn * 0.055);
      var heavySolaceCost = inAdrenaline ? 0 : Math.max(1, 3 - Math.floor(brawn / 3));
      return { swingDuration: swingDuration, heavySolaceCost: heavySolaceCost };
    },

    updateRecovery: function (dt) {
      if (recoveryState.cooldown > 0) {
        recoveryState.cooldown = Math.max(0, recoveryState.cooldown - dt);
      }
      if (V.Character && typeof V.Character.tickTimers === 'function') {
        V.Character.tickTimers(dt);
      }
    },

    spendSolace: function (amount, reason) {
      if (V.Character && V.Character.isInAdrenaline()) {
        logCombat('ADRENALINE SURGE // 0 SOLACE EXPENDED [' + (reason || 'EXERTION') + ']');
        return true;
      }

      var currentSolace = V.State && typeof V.State.solace === 'number' ? V.State.solace : 3;
      if (currentSolace < amount) return false;

      if (V.State) {
        V.State.solace = currentSolace - amount;
        V.State.malignancy = (V.State.malignancy || 0) + amount;

        var prevRot = V.State.rotTier || 1;
        if (V.State.malignancy >= 9) V.State.rotTier = Math.max(prevRot, 4);
        else if (V.State.malignancy >= 6) V.State.rotTier = Math.max(prevRot, 3);
        else if (V.State.malignancy >= 3) V.State.rotTier = Math.max(prevRot, 2);

        if (V.State.rotTier > prevRot) {
          if (V.Shader && typeof V.Shader.setRotTier === 'function') {
            V.Shader.setRotTier(V.State.rotTier);
          }
          logCombat(
            'MALIGNANCY [' + V.State.malignancy + '] // LABYRINTH DEGRADES TO ROT TIER ' + V.State.rotTier + '!',
            true
          );
        }
      }

      if (V.Character) V.Character.syncVesselModal();
      return true;
    },

    triggerAutoPauseInterrupt: function (enemyObj) {
      if (V.State && (V.State.mode === 'AUTO_PAUSE' || V.State.isProcessingChoice)) {
        return;
      }

      var enemy = enemyObj || {
        id: 'enemy_stench_01',
        name: 'The Stench Champion',
        baseTN: 10,
        inflictsComplication: 'SHATTERED_RIBS'
      };
      recoveryState.activeEnemy = enemy;

      var diffMult = getDifficultyMultiplier();
      var rotPen = getRotTierPenalty();
      var scaledTN = Math.round((enemy.baseTN || 10) * diffMult) + rotPen;
      recoveryState.activeThreatTN = scaledTN;

      if (V.State) {
        V.State.mode = 'AUTO_PAUSE';
        V.State.currentPhase = 'AUTO_PAUSE';
        V.State.isProcessingChoice = false;
      }

      if (V.State && typeof V.State.setPhaseView === 'function') {
        V.State.setPhaseView('AUTO_PAUSE');
      } else if (V.UI && typeof V.UI.setPhaseView === 'function') {
        V.UI.setPhaseView('AUTO_PAUSE');
      }

      this.populateChoiceDeckLabels(enemy, scaledTN);
      syncChoiceDeckVisibility();

      logCombat(
        'AUTO-PAUSE INTERRUPT // ' + enemy.name.toUpperCase() + ' STRIKES! [THREAT TN: ' + scaledTN + ']',
        true
      );
    },

    populateChoiceDeckLabels: function (enemy, threatTN) {
      var choiceDeck = document.getElementById('choice-deck');
      if (!choiceDeck) return;

      var defenseAV = V.Character
        ? V.Character.computeActionValue('brawn', 'melee', 'DEFENSE', false)
        : 6;
      var distName = (V.State && V.State.distinction) || 'Miner Knight';
      var compId = enemy.inflictsComplication || 'SHATTERED_RIBS';
      var compCatalog = V.Character && V.Character.complicationCatalog;
      var compName = (compCatalog && compCatalog[compId] && compCatalog[compId].name) || 'Shattered Ribs';

      var rows = choiceDeck.querySelectorAll('.choice-row');
      if (rows.length >= 4) {
        rows[0].textContent =
          '[1] BURN 1 SOLACE (+3 AV -> ' + (defenseAV + 3) + ' VS TN ' + threatTN + ') -> DEFLECT & +1 MALIGNANCY';
        rows[1].textContent =
          "[2] ACCEPT IMPACT -> GAIN COMPLICATION: '" + compName.toUpperCase() + "' & TRIGGER ADRENALINE (10s)";
        rows[2].textContent =
          "[3] INVOKE DISTINCTION: '" + distName.toUpperCase() + "' (+2 AV) -> STEP INTO CATACOMB DRAFT";
        rows[3].textContent =
          '[4] EXERT FLESH (1 SOLACE) -> FORCE BACKPEDAL OUT OF 1.5s TELEGRAPH ARC';
      }
    },

    handleChoiceClick: function (choiceKey) {
      if (!V.State || V.State.mode !== 'AUTO_PAUSE' || V.State.isProcessingChoice) {
        return;
      }

      V.State.isProcessingChoice = true;
      syncChoiceDeckVisibility();

      var k = String(choiceKey);
      var enemy = recoveryState.activeEnemy;
      var threatTN = recoveryState.activeThreatTN;
      var baseAV = V.Character
        ? V.Character.computeActionValue('brawn', 'melee', 'DEFENSE', false)
        : 6;

      if (k === '1') {
        if (this.spendSolace(1, 'SOLACE DEFLECT')) {
          if (enemy && typeof enemy.pushBack === 'function') enemy.pushBack(1.65);
          logCombat('SOLACE BURNED (+3 AV -> ' + (baseAV + 3) + ') // CLEAVER DEFLECTED. +1 MALIGNANCY.');
        } else {
          if (V.Character) V.Character.inflictComplication((enemy && enemy.inflictsComplication) || 'SHATTERED_RIBS');
          logCombat('INSUFFICIENT SOLACE // GUARD BROKEN! COMPLICATION INFLICTED.', true);
        }
      } else if (k === '2') {
        var comp = V.Character
          ? V.Character.inflictComplication((enemy && enemy.inflictsComplication) || 'SHATTERED_RIBS')
          : { name: 'Shattered Ribs' };
        if (enemy && typeof enemy.pushBack === 'function') enemy.pushBack(1.35);
        logCombat(
          'IMPACT ACCEPTED // GAINED COMPLICATION: ' + comp.name.toUpperCase() + '. ADRENALINE SURGE (10S)!',
          true
        );
      } else if (k === '3') {
        var distAV = V.Character
          ? V.Character.computeActionValue('brawn', 'melee', 'DEFENSE', true)
          : baseAV + 2;
        if (distAV >= threatTN) {
          if (enemy && typeof enemy.takeDeterministicStrike === 'function') {
            enemy.takeDeterministicStrike(1);
          }
          logCombat('INVOKED DISTINCTION (AV ' + distAV + ' >= TN ' + threatTN + ') // SHIFTED WITH THE BREEZE & COUNTERED!');
        } else {
          this.spendSolace(1, 'DISTINCTION BRIDGE');
          if (enemy && typeof enemy.pushBack === 'function') enemy.pushBack(1.4);
          logCombat('INVOKED DISTINCTION (AV ' + distAV + ') + 1 SOLACE // GRAZED PAST TELEGRAPH.');
        }
      } else if (k === '4') {
        if (V.Character && V.Character.hasRetreatBlock()) {
          V.Character.inflictComplication('INFECTION');
          logCombat('RETREAT BLOCKED BY [SHATTERED RIBS] // STRUCK WHILE FLEEING!', true);
        } else {
          this.spendSolace(1, 'EMERGENCY BACKPEDAL');
          if (V.Raycaster && typeof V.Raycaster.tryMovePlayer === 'function' && V.State && V.State.player) {
            V.Raycaster.tryMovePlayer(-V.State.player.dirX * 1.2, -V.State.player.dirY * 1.2);
          }
          if (enemy && typeof enemy.resetTelegraph === 'function') enemy.resetTelegraph();
          logCombat('FLESH EXERTED (-1 SOLACE) // BACKPEDALED OUT OF TELEGRAPH ARC.');
        }
      }

      setTimeout(function () {
        if (V.State) {
          V.State.mode = 'SPATIAL_HUNT';
          V.State.currentPhase = 'SPATIAL_HUNT';
          V.State.isProcessingChoice = false;
        }
        syncChoiceDeckVisibility();

        if (V.State && typeof V.State.setPhaseView === 'function') {
          V.State.setPhaseView('SPATIAL_HUNT');
        } else if (V.UI && typeof V.UI.setPhaseView === 'function') {
          V.UI.setPhaseView('SPATIAL_HUNT');
        }
        if (V.Character) V.Character.syncVesselModal();
      }, 450);
    },

    bindCombatTriggers: function () {
      var self = this;
      var bindFn = (V.UI && V.UI.bindAction) || V.bindAction;
      if (typeof bindFn !== 'function') return;

      bindFn('#btn-sim-autopause, #btn-touch-enc', 'click', function () {
        self.triggerAutoPauseInterrupt();
      });

      bindFn('.choice-row', 'click', function (e) {
        var row = e.currentTarget || (e.target && e.target.closest('.choice-row'));
        if (!row) return;
        var key = row.dataset.key || row.dataset.choice || '1';
        self.handleChoiceClick(key);
      });

      window.addEventListener('keydown', function (e) {
        if (V.State && V.State.mode === 'AUTO_PAUSE' && !V.State.isProcessingChoice) {
          if (e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            self.handleChoiceClick(e.key);
          }
        }
      });

      window.addEventListener('VermisPhaseChanged', function () {
        syncChoiceDeckVisibility();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      V.Combat.initialize();
    });
  } else {
    V.Combat.initialize();
  }
})();

