/* ============================================================================
   VERMIS // MODULE 03: DICELESS 20-POINT VESSEL BUILDER & 6-STAGE STAT PIPELINE
   File Address: vermis-engine/js/rpg/character.js
   Version: v1.5.2
   Implements: 20-Point Buy Matrix (12 Allocatable BP + 8 Base), Doomed Seed
               Randomizer, 6-Stage Dirty-Flag Stat Cache, Reverse-Order Unique-ID
               Buff Tracking, Complication Registry, & Decay Portrait Renderer
   ============================================================================ */

window.VERMIS = window.VERMIS || {};

(function () {
  'use strict';

  var V = window.VERMIS;

  if (typeof V.bindAction !== 'function') {
    V.bindAction = function (selectorOrEl, eventType, handler) {
      var elements =
        typeof selectorOrEl === 'string'
          ? document.querySelectorAll(selectorOrEl)
          : selectorOrEl instanceof Element
          ? [selectorOrEl]
          : [];
      var guardKey = 'vermisBound_' + eventType;
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        if (!el || el.dataset[guardKey] === 'true') continue;
        el.dataset[guardKey] = 'true';
        el.addEventListener(eventType, handler);
      }
    };
  }

  var DISTINCTIONS = {
    'Miner Knight': {
      id: 'Miner Knight',
      bonusDomain: 'athletics',
      bonusContexts: ['DEFENSE', 'MELEE', 'MIASMA', 'COLLAPSE'],
      bonusAV: 2,
      solaceCapBonus: 0,
      lore: '+2 AV in subterranean hazards, physical bracing, and Miasma tolerance.'
    },
    'Murk Sage': {
      id: 'Murk Sage',
      bonusDomain: 'occult',
      bonusContexts: ['OCCULT', 'MIASMA', 'LORE', 'ROT'],
      bonusAV: 2,
      solaceCapBonus: 0,
      lore: '+2 AV on Occult rituals & Silver Swamp lore checks.'
    },
    'Rat Man': {
      id: 'Rat Man',
      bonusDomain: 'scavenging',
      bonusContexts: ['SCAVENGING', 'RETREAT', 'TRAP', 'EVASION'],
      bonusAV: 2,
      solaceCapBonus: 0,
      lore: '+2 AV when scavenging filth, spotting traps, or evading ambushes.'
    },
    'Cursed Fool': {
      id: 'Cursed Fool',
      bonusDomain: 'willpower',
      bonusContexts: ['DIALOGUE', 'OCCULT', 'DEFENSE'],
      bonusAV: 1,
      solaceCapBonus: 1,
      lore: 'Unlocks unique dialogue nodes and +1 maximum Solace cap.'
    },
    'Prophet': {
      id: 'Prophet',
      bonusDomain: 'willpower',
      bonusContexts: ['WILLPOWER', 'DREAD', 'OCCULT'],
      bonusAV: 2,
      solaceCapBonus: 0,
      lore: '+2 Willpower AV against Dread, Fear, and Insanity.'
    },
    'Mad Pricker': {
      id: 'Mad Pricker',
      bonusDomain: 'melee',
      bonusContexts: ['MELEE', 'OFFENSE'],
      bonusAV: 2,
      solaceCapBonus: 0,
      lore: '+2 Melee Pierce AV and passive Bleed infliction.'
    }
  };

  var COMPLICATIONS = {
    SHATTERED_RIBS: {
      id: 'SHATTERED_RIBS',
      name: 'Shattered Ribs',
      weight: 3,
      blocksRetreat: true,
      penalties: { brawn: 2, athletics: 1 },
      lore: 'Jagged bone splinters grate with every breath. (-2 BRAWN, -1 ATHLETICS, Blocks Retreat)'
    },
    INFECTION: {
      id: 'INFECTION',
      name: 'Festering Infection',
      weight: 2,
      blocksRetreat: false,
      penalties: { agility: 2 },
      lore: 'Black catacomb spores take root in open lacerations. (-2 AGILITY)'
    },
    WHITE_HIVES: {
      id: 'WHITE_HIVES',
      name: "Kethereth's White Hives",
      weight: 3,
      blocksRetreat: false,
      penalties: { willpower: 2, wits: 1 },
      lore: 'Pale subcutaneous larvae hum beneath your scalp. (-2 WILLPOWER, -1 WITS)'
    },
    BLINDNESS: {
      id: 'BLINDNESS',
      name: 'Ocular Rot',
      weight: 4,
      blocksRetreat: false,
      penalties: { wits: 3, scavenging: 1 },
      lore: 'Milky cataracts constrict your sight into the gloom. (-3 WITS, -1 SCAVENGING)'
    }
  };

  var buildPoints = 12;

  var builderStats = {
    characteristics: {
      brawn:     { val: 2, min: 2, max: 8, cost: 1 },
      agility:   { val: 2, min: 2, max: 8, cost: 1 },
      wits:      { val: 2, min: 2, max: 8, cost: 1 },
      willpower: { val: 2, min: 2, max: 8, cost: 1 }
    },
    disciplines: {
      melee:      { val: 0, min: 0, max: 5, cost: 1 },
      athletics:  { val: 0, min: 0, max: 5, cost: 1 },
      scavenging: { val: 0, min: 0, max: 5, cost: 1 },
      occult:     { val: 0, min: 0, max: 5, cost: 1 }
    },
    solace: { val: 3, min: 3, max: 5, cost: 2 }
  };

  var statCache = {
    isDirty: true,
    values: {},
    traumaDrag: 0
  };

  var activeBuffs = [];
  var activeComplications = [];
  var gearModifiers = {
    brawn: 0,
    agility: 0,
    wits: 0,
    willpower: 0,
    melee: 0,
    athletics: 0,
    scavenging: 0,
    occult: 0,
    armorAV: 0,
    weaponAV: 1
  };

  var adrenalineRemaining = 0;
  var exhaustionRemaining = 0;

  function logMsg(msg, isAlert) {
    if (V.UI && typeof V.UI.logTelemetry === 'function') {
      V.UI.logTelemetry(msg, Boolean(isAlert));
    } else if (V.UI && typeof V.UI.log === 'function') {
      V.UI.log(msg, Boolean(isAlert));
    } else if (typeof V.logTelemetry === 'function') {
      V.logTelemetry(msg, Boolean(isAlert));
    }
  }

  V.Character = {
    distinctions: DISTINCTIONS,
    complicationCatalog: COMPLICATIONS,

    initialize: function () {
      this.renderBuilder();
      this.bindBuilderControls();
      this.syncVesselModal();
      this.renderDecayPortrait();
      this.renderActiveBuffs();
    },

    markDirty: function () {
      statCache.isDirty = true;
    },

    getRemainingBuildPoints: function () {
      return buildPoints;
    },

    getRawBuilderStats: function () {
      return JSON.parse(JSON.stringify(builderStats));
    },

    importStats: function (savedStats, savedBP) {
      if (!savedStats) return;
      var charSrc = savedStats.characteristics || savedStats.char;
      var discSrc = savedStats.disciplines || savedStats.disc;

      if (charSrc) {
        Object.keys(builderStats.characteristics).forEach(function (k) {
          var v = typeof charSrc[k] === 'object' ? charSrc[k].val : charSrc[k];
          if (typeof v === 'number') builderStats.characteristics[k].val = v;
        });
      }
      if (discSrc) {
        Object.keys(builderStats.disciplines).forEach(function (k) {
          var v = typeof discSrc[k] === 'object' ? discSrc[k].val : discSrc[k];
          if (typeof v === 'number') builderStats.disciplines[k].val = v;
        });
      }
      if (savedStats.solace) {
        var sv = typeof savedStats.solace === 'object' ? savedStats.solace.val : savedStats.solace;
        if (typeof sv === 'number') builderStats.solace.val = sv;
      }

      buildPoints = typeof savedBP === 'number' ? savedBP : 0;
      this.markDirty();
      this.renderBuilder();
      this.syncVesselModal();
      this.renderDecayPortrait();
    },

    modifyStat: function (cat, key, delta) {
      var normCat =
        cat === 'char'
          ? 'characteristics'
          : cat === 'disc'
          ? 'disciplines'
          : cat;

      var target =
        normCat === 'solace'
          ? builderStats.solace
          : builderStats[normCat] && builderStats[normCat][key];
      if (!target) return;

      var pointCost = target.cost * delta;
      if (delta > 0 && buildPoints - pointCost < 0) return;
      if (target.val + delta > target.max || target.val + delta < target.min) return;

      target.val += delta;
      buildPoints -= pointCost;

      if (normCat === 'solace' && V.State) {
        V.State.solace = target.val;
      }

      this.markDirty();
      this.renderBuilder();
      this.syncVesselModal();
    },

    modStat: function (group, key, delta) {
      this.modifyStat(group, key, delta);
    },

    modSolace: function (delta) {
      this.modifyStat('solace', null, delta);
    },

    randomizeDoomedSeed: function () {
      buildPoints = 12;
      Object.keys(builderStats.characteristics).forEach(function (k) {
        builderStats.characteristics[k].val = 2;
      });
      Object.keys(builderStats.disciplines).forEach(function (k) {
        builderStats.disciplines[k].val = 0;
      });
      builderStats.solace.val = 3;

      var rng =
        V.State && typeof V.State.rng === 'function'
          ? function () { return V.State.rng(); }
          : function () { return Math.random(); };

      var pool = [];
      Object.keys(builderStats.characteristics).forEach(function (k) {
        pool.push({ c: 'characteristics', k: k });
      });
      Object.keys(builderStats.disciplines).forEach(function (k) {
        pool.push({ c: 'disciplines', k: k });
      });

      while (buildPoints > 0) {
        var pick = pool[Math.floor(rng() * pool.length)];
        var statObj = builderStats[pick.c][pick.k];
        if (statObj.val < statObj.max) {
          statObj.val += 1;
          buildPoints -= 1;
        }
      }

      var selectEl = document.getElementById('distinction-select');
      if (selectEl && selectEl.options.length > 0) {
        selectEl.selectedIndex = Math.floor(rng() * selectEl.options.length);
      }

      this.markDirty();
      this.renderBuilder();
      this.syncVesselModal();
      logMsg('DOOMED SEED EXECUTED // VESSEL ATTRIBUTES RANDOMIZED.', true);
    },

    randomizeSeed: function () {
      this.randomizeDoomedSeed();
    },

    renderBuilder: function () {
      var self = this;
      var bpDisplay = document.getElementById('bp-display');
      if (bpDisplay) bpDisplay.textContent = String(buildPoints);

      var solaceDisplay = document.getElementById('stat-solace');
      if (solaceDisplay) solaceDisplay.textContent = String(builderStats.solace.val);

      var containerMap = {
        characteristics:
          document.getElementById('characteristics-list') ||
          document.getElementById('stat-list-char'),
        disciplines:
          document.getElementById('disciplines-list') ||
          document.getElementById('stat-list-disc')
      };

      ['characteristics', 'disciplines'].forEach(function (cat) {
        var container = containerMap[cat];
        if (!container) return;
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        Object.keys(builderStats[cat]).forEach(function (key) {
          var obj = builderStats[cat][key];
          var row = document.createElement('div');
          row.className = 'stat-row';

          var labelSpan = document.createElement('span');
          labelSpan.textContent = key.toUpperCase();

          var stepperDiv = document.createElement('div');
          stepperDiv.className = 'stat-stepper';

          var minusBtn = document.createElement('button');
          minusBtn.type = 'button';
          minusBtn.className = 'ui-btn builder-mod';
          minusBtn.textContent = '-';
          minusBtn.addEventListener('click', function () {
            self.modifyStat(cat, key, -1);
          });

          var valStrong = document.createElement('strong');
          valStrong.style.display = 'inline-block';
          valStrong.style.width = '22px';
          valStrong.style.textAlign = 'center';
          valStrong.textContent = String(obj.val);

          var plusBtn = document.createElement('button');
          plusBtn.type = 'button';
          plusBtn.className = 'ui-btn builder-mod';
          plusBtn.textContent = '+';
          plusBtn.addEventListener('click', function () {
            self.modifyStat(cat, key, 1);
          });

          stepperDiv.appendChild(minusBtn);
          stepperDiv.appendChild(valStrong);
          stepperDiv.appendChild(plusBtn);

          row.appendChild(labelSpan);
          row.appendChild(stepperDiv);
          container.appendChild(row);
        });
      });
    },

    bindBuilderControls: function () {
      var self = this;
      V.bindAction('#btn-solace-dec', 'click', function () {
        self.modifyStat('solace', null, -1);
      });
      V.bindAction('#btn-solace-inc', 'click', function () {
        self.modifyStat('solace', null, 1);
      });
      V.bindAction('[data-action="doomed_seed"]', 'click', function () {
        self.randomizeDoomedSeed();
      });
      V.bindAction('[data-action="finalize_build"]', 'click', function () {
        self.finalizeBuilder();
      });
    },

    exportVesselState: function () {
      var selectEl = document.getElementById('distinction-select');
      var distinction = selectEl ? selectEl.value : (V.State && V.State.distinction) || 'Miner Knight';
      var distData = DISTINCTIONS[distinction] || DISTINCTIONS['Miner Knight'];
      return {
        distinction: distinction,
        solace: builderStats.solace.val,
        maxSolace: 5 + (distData.solaceCapBonus || 0),
        stats: this.getRawBuilderStats(),
        remainingBP: buildPoints
      };
    },

    finalizeBuilder: function (currentDiff) {
      var exported = this.exportVesselState();
      if (V.State) {
        V.State.distinction = exported.distinction;
        V.State.solace = exported.solace;
        V.State.maxSolace = exported.maxSolace;
        V.State.currentPhase = 'SPATIAL_HUNT';
        V.State.mode = 'SPATIAL_HUNT';
        V.State.isProcessingChoice = false;
        if (typeof V.State.saveGame === 'function') {
          V.State.saveGame(exported.stats);
        }
      } else {
        localStorage.setItem(
          'VERMIS_SAVE_STATE',
          JSON.stringify({
            distinction: exported.distinction,
            solace: exported.solace,
            stats: exported.stats,
            diff: currentDiff || 'UNFORGIVING'
          })
        );
      }

      var choiceDeck = document.getElementById('choice-deck');
      if (choiceDeck) {
        choiceDeck.hidden = true;
        choiceDeck.style.display = 'none';
        choiceDeck.style.pointerEvents = 'none';
      }

      this.syncVesselModal();
      this.renderDecayPortrait();

      if (V.Raycaster && typeof V.Raycaster.initLabyrinth === 'function') {
        V.Raycaster.initLabyrinth();
      }
      if (V.State && typeof V.State.setPhaseView === 'function') {
        V.State.setPhaseView('SPATIAL_HUNT');
      } else if (V.UI && typeof V.UI.setPhaseView === 'function') {
        V.UI.setPhaseView('SPATIAL_HUNT');
      }
      if (V.State && typeof V.State.startMasterClock === 'function') {
        V.State.startMasterClock();
      }

      logMsg('VESSEL INITIALIZED: [' + exported.distinction.toUpperCase() + ']');
    },

    // ========================================================================
    // 6-STAGE DIRTY-FLAG STAT PIPELINE
    // ========================================================================
    recalculatePipeline: function () {
      var out = {};

      // Stage 1: Base 20-Point Allocation
      Object.keys(builderStats.characteristics).forEach(function (k) {
        out[k] = builderStats.characteristics[k].val;
      });
      Object.keys(builderStats.disciplines).forEach(function (k) {
        out[k] = builderStats.disciplines[k].val;
      });

      // Stage 2: Equipped Paper-Doll Gear Modifiers
      Object.keys(out).forEach(function (k) {
        if (typeof gearModifiers[k] === 'number') {
          out[k] += gearModifiers[k];
        }
      });

      // Stage 3: Unique-ID Active Buffs
      for (var i = 0; i < activeBuffs.length; i++) {
        var buff = activeBuffs[i];
        if (buff.stat && typeof out[buff.stat] === 'number') {
          out[buff.stat] += buff.flatBonus || 0;
        }
      }

      // Stage 4: Complication Trauma Penalties & Total Trauma Drag
      var totalTraumaWeight = 0;
      for (var c = 0; c < activeComplications.length; c++) {
        var comp = activeComplications[c];
        totalTraumaWeight += comp.weight || 2;
        if (comp.penalties) {
          Object.keys(comp.penalties).forEach(function (statKey) {
            if (typeof out[statKey] === 'number') {
              out[statKey] -= comp.penalties[statKey];
            }
          });
        }
      }
      statCache.traumaDrag = totalTraumaWeight;

      // Stage 5: Adrenaline Surge (+2 Brawn/Agility) or Post-Adrenaline Crash (-1 Brawn/Agility)
      if (adrenalineRemaining > 0) {
        out.brawn += 2;
        out.agility += 2;
      } else if (exhaustionRemaining > 0) {
        out.brawn -= 1;
        out.agility -= 1;
      }

      // Stage 6: Clamp [0..12]
      Object.keys(out).forEach(function (k) {
        out[k] = Math.max(0, Math.min(12, out[k]));
      });

      statCache.values = out;
      statCache.isDirty = false;
    },

    getEffectiveStat: function (statKey) {
      if (statCache.isDirty) {
        this.recalculatePipeline();
      }
      return typeof statCache.values[statKey] === 'number' ? statCache.values[statKey] : 0;
    },

    getTraumaWeight: function () {
      if (statCache.isDirty) this.recalculatePipeline();
      return statCache.traumaDrag || (V.State ? V.State.complications || 0 : 0);
    },

    computeActionValue: function (charKey, discKey, contextTag, invokeDistinction) {
      var cKey = charKey || 'brawn';
      var dKey = discKey || 'melee';
      var ctxTag = contextTag || 'MELEE';

      var charVal = this.getEffectiveStat(cKey);
      var discVal = this.getEffectiveStat(dKey);
      var av = charVal + discVal;

      if (ctxTag === 'MELEE' || ctxTag === 'OFFENSE') {
        av += gearModifiers.weaponAV || 0;
      } else if (ctxTag === 'DEFENSE') {
        av += gearModifiers.armorAV || 0;
      }

      var selEl = document.getElementById('distinction-select');
      var distName =
        (V.State && V.State.distinction) ||
        (selEl ? selEl.value : 'Miner Knight');
      var distObj = DISTINCTIONS[distName] || DISTINCTIONS['Miner Knight'];

      if (
        invokeDistinction ||
        distObj.bonusDomain === dKey ||
        distObj.bonusDomain === cKey ||
        (distObj.bonusContexts && distObj.bonusContexts.indexOf(ctxTag) !== -1)
      ) {
        av += distObj.bonusAV;
      }

      return Math.max(1, av);
    },

    setGearModifiers: function (newMods) {
      if (!newMods) return;
      Object.keys(newMods).forEach(function (k) {
        gearModifiers[k] = newMods[k];
      });
      this.markDirty();
      this.syncVesselModal();
    },

    applyBuff: function (buffObj) {
      if (!buffObj || !buffObj.id) return;
      for (var i = 0; i < activeBuffs.length; i++) {
        if (activeBuffs[i].id === buffObj.id) {
          activeBuffs[i].remaining = buffObj.duration || activeBuffs[i].duration;
          this.renderActiveBuffs();
          logMsg('BUFF REFRESHED: [' + activeBuffs[i].name.toUpperCase() + ']');
          return;
        }
      }

      activeBuffs.push({
        id: buffObj.id,
        name: buffObj.name || buffObj.id,
        stat: buffObj.stat || null,
        flatBonus: buffObj.flatBonus || 0,
        duration: buffObj.duration || 20,
        remaining: buffObj.duration || 20
      });

      this.markDirty();
      this.syncVesselModal();
      this.renderActiveBuffs();
      logMsg('BUFF APPLIED: [' + (buffObj.name || buffObj.id).toUpperCase() + ']');
    },

    tickTimers: function (dt) {
      var changed = false;
      for (var i = activeBuffs.length - 1; i >= 0; i--) {
        activeBuffs[i].remaining -= dt;
        if (activeBuffs[i].remaining <= 0) {
          var expired = activeBuffs.splice(i, 1)[0];
          changed = true;
          logMsg('BUFF EXPIRED: [' + expired.name.toUpperCase() + ']');
        }
      }

      if (adrenalineRemaining > 0) {
        adrenalineRemaining = Math.max(0, adrenalineRemaining - dt);
        if (adrenalineRemaining === 0) {
          exhaustionRemaining = 4.0;
          changed = true;
          logMsg('ADRENALINE SUBSIDES // EXHAUSTION CRASH (-1 BRAWN/AGILITY FOR 4.0S).', true);
        }
      } else if (exhaustionRemaining > 0) {
        exhaustionRemaining = Math.max(0, exhaustionRemaining - dt);
        if (exhaustionRemaining === 0) changed = true;
      }

      if (changed) {
        this.markDirty();
        this.syncVesselModal();
        this.renderActiveBuffs();
      }
    },

    inflictComplication: function (compId) {
      var template = COMPLICATIONS[compId] || COMPLICATIONS.SHATTERED_RIBS;
      var exists = false;
      for (var i = 0; i < activeComplications.length; i++) {
        if (activeComplications[i].id === template.id) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        activeComplications.push(template);
      }

      adrenalineRemaining = 10.0;
      this.markDirty();

      var totalTrauma = this.getTraumaWeight();
      if (V.State) {
        V.State.complications = totalTrauma;
      }

      this.syncVesselModal();
      this.renderDecayPortrait();
      this.renderActiveBuffs();
      return template;
    },

    hasRetreatBlock: function () {
      for (var i = 0; i < activeComplications.length; i++) {
        if (activeComplications[i].blocksRetreat) return true;
      }
      return false;
    },

    isInAdrenaline: function () {
      return adrenalineRemaining > 0;
    },

    syncVesselModal: function () {
      var brawnEl = document.getElementById('modal-stat-brawn');
      var agilityEl = document.getElementById('modal-stat-agility');
      var witsEl = document.getElementById('modal-stat-wits');
      var willpowerEl = document.getElementById('modal-stat-willpower');

      if (brawnEl) brawnEl.textContent = String(this.getEffectiveStat('brawn'));
      if (agilityEl) agilityEl.textContent = String(this.getEffectiveStat('agility'));
      if (witsEl) witsEl.textContent = String(this.getEffectiveStat('wits'));
      if (willpowerEl) willpowerEl.textContent = String(this.getEffectiveStat('willpower'));

      var traumaEl = document.getElementById('val-traumas');
      if (traumaEl) {
        traumaEl.textContent = this.getTraumaWeight() + '/12';
      }
      var solaceEl = document.getElementById('val-solace');
      if (solaceEl) {
        var sVal = V.State && typeof V.State.solace === 'number' ? V.State.solace : builderStats.solace.val;
        solaceEl.textContent = String(sVal);
      }
      var malEl = document.getElementById('val-malignancy');
      if (malEl && V.State) {
        malEl.textContent = String(V.State.malignancy || 0);
      }
    },

    renderActiveBuffs: function () {
      var listEl = document.getElementById('active-buff-list');
      if (!listEl) return;
      while (listEl.firstChild) {
        listEl.removeChild(listEl.firstChild);
      }

      if (activeBuffs.length === 0 && activeComplications.length === 0) {
        var emptyPill = document.createElement('span');
        emptyPill.className = 'buff-pill';
        emptyPill.textContent = 'NO ACTIVE AFFLICTIONS';
        listEl.appendChild(emptyPill);
        return;
      }

      for (var i = 0; i < activeBuffs.length; i++) {
        var b = activeBuffs[i];
        var pill = document.createElement('span');
        pill.className = 'buff-pill';
        pill.style.borderColor = '#7a9c54';
        pill.style.color = '#a8ffb2';
        pill.textContent = '+' + b.name.toUpperCase() + ' (' + Math.ceil(b.remaining) + 's)';
        listEl.appendChild(pill);
      }

      for (var j = 0; j < activeComplications.length; j++) {
        var c = activeComplications[j];
        var cPill = document.createElement('span');
        cPill.className = 'buff-pill';
        cPill.style.borderColor = '#ff003c';
        cPill.style.color = '#ff003c';
        cPill.textContent = '! ' + c.name.toUpperCase() + ' (WT:' + c.weight + ')';
        listEl.appendChild(cPill);
      }
    },

    renderDecayPortrait: function () {
      var canvas = document.getElementById('decay-portrait-canvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var w = canvas.width || 96;
      var h = canvas.height || 96;

      var trauma = this.getTraumaWeight();
      var decayStage = Math.min(3, Math.floor(trauma / 3));

      ctx.fillStyle = '#070906';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = decayStage >= 2 ? '#3b150e' : '#1b2616';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, 38, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = decayStage === 0 ? '#c8bf9e' : decayStage === 1 ? '#96ab76' : '#8f391e';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.44, 20 - decayStage * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillRect(w * 0.5 - 12 + decayStage, h * 0.48, 24 - decayStage * 2, 18);

      ctx.fillStyle = '#050604';
      ctx.fillRect(w * 0.5 - 10, h * 0.41, 7, 5 + decayStage);
      ctx.fillRect(w * 0.5 + 3, h * 0.41, 7, 5 + decayStage);

      if (adrenalineRemaining > 0 || decayStage >= 2) {
        ctx.fillStyle = '#ff003c';
        ctx.fillRect(w * 0.5 - 7, h * 0.43, 2, 2);
        ctx.fillRect(w * 0.5 + 6, h * 0.43, 2, 2);
      }

      ctx.fillStyle = '#050604';
      for (var t = -3; t <= 3; t++) {
        ctx.fillRect(w * 0.5 + t * 3, h * 0.57, 1.5, 4 + decayStage * 1.5);
      }

      ctx.strokeStyle = decayStage >= 2 ? '#ff003c' : '#38472b';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
  };

  window.addEventListener('VermisCreationPhaseEntered', function () {
    V.Character.renderBuilder();
  });

  window.addEventListener('VermisDoomedSeedRequested', function () {
    V.Character.randomizeDoomedSeed();
  });

  window.addEventListener('VermisModalOpened', function (e) {
    if (e && e.detail && e.detail.modalId === 'modal-vessel') {
      V.Character.syncVesselModal();
      V.Character.renderDecayPortrait();
      V.Character.renderActiveBuffs();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      V.Character.initialize();
    });
  } else {
    V.Character.initialize();
  }
})();

