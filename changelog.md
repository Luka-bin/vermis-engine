# VERMIS ENGINE // MASTER CHANGELOG & ARCHITECTURE LOG
**Last Updated:** October 21, 2026 (04:55 CDT)  
**Notebook Source:** 🐛 [Vermis Dark Fantasy Engine Laboratory](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

### [2026-10-21 04:55 CDT] Module 01 (v1.5.5 Refined 100dvh Handheld Shell, Complete Virtual Pad Editor & Full Module Hook Restoration: `index.html`)
#### Summary of Changes
* **Refined `index_3.html` (`v1.5.4`) into Master `index.html` (`v1.5.5`):**
  * Preserved the strict `100dvh` zero-scroll flexbox lock (`html, body`, `#monitor-bezel`, `#screen.crt-screen-frame`, `#gameplay-stage`, `#terminal-deck`, `.touch-deck-2ds`) and expanded the Canvas `NaN`/`Infinity` crash guard in `<head>` to protect both `createLinearGradient` and `createRadialGradient`.
  * Preserved the `#33ff33` Pip-Boy / MS-DOS boot terminal CSS (`.bios-box`, `.bios-header`, `.bios-log`, `.cursor-blink`), fixed the multi-line ASCII skull crest in `#title-screen-view`, and enforced the 3-Stage Boot Pipeline (`BOOT` -> `TITLE_SCREEN` -> `MAIN_MENU`).
* **Completed Per-Button Virtual Gamepad Editor (`initPadEditor` in `index.html`):**
  * Wired the previously unlinked `#btn-vpad-snap` (toggles `12px` grid-snap vs. free movement during drag) and `#btn-vpad-reset` (restores default coordinates and `100%` scale for all `.vpad-widget` items).
  * Added `[Q]` (`slot_q`) and `[E]` (`slot_e`) hotkey widgets to `#mobile-touch-deck`, clamped widget dragging strictly inside `.touch-deck-2ds` bounds, and added `localStorage` persistence (`VERMIS_PAD_LAYOUT_V1`).
  * Upgraded `initVpadBridge()` so virtual controls update both `VERMIS.inputMap[act]` boolean flags and `VERMIS.inputMap.activeActions` (`Set`) while invoking `setActionState()` / `syncInputBridge()` for seamless Module 02/03 movement.
* **Restored Stripped DOM Hooks Required by Modules 00, 02, 03, & 04 (`index.html`):**
  * Replaced the placeholder stubs in `#builder-view`, `#modal-vessel`, `#modal-inventory`, `#remap-modal`, and `#preferences-modal` with the full DOM IDs required by `settings.js`, `state.js`, `character.js`, `combat.js`, `controls.js`, `ui-dragger.js`, and `raycaster.js`.
  * Restored explicit `width="320" height="400"` on `#visual-stage-canvas` and restored `#gbuffer-debug-canvas`, `#choice-deck` (strictly `hidden` outside `AUTO_PAUSE`), `#decay-portrait-canvas`, `#hook-readout`, `.paper-doll-layout`, and `#strategy-guide-inspector`.
* **Unified `V_UI` & `VERMIS.UI` API + Complete 12-Module Loader Queue:**
  * Bridged `window.V_UI` and `window.VERMIS.UI` (`setPhase` / `setPhaseView`, `openModal`, `closeModals` / `closeAllModals`, `logTelemetry`) and expanded the sequential loader queue to mount all 12 files from `directory.md` (`v1.4.1`) with `#hook-readout` verification.

---

### [2026-10-21 04:05 CDT] Module 03 (v1.5.2 Raycaster Clock Aliases, Live Cartography & Strict `#choice-deck` Gate)
* **Exported `update(dt)` & `render(time)` Master Clock Wrappers (`js/engine/raycaster.js`):**
  * Exported `VERMIS.Raycaster.update(dt)` as an alias for `updateSpatialMovement(dt)` and `VERMIS.Raycaster.render(time)` as a wrapper calling `renderDungeonGBuffer(time)` followed by `presentFallbackLitho()`.
* **Live `#cartography-canvas` Updates on Movement & Rotation (`js/engine/raycaster.js`):**
  * Updated `tryMovePlayer(dx, dy)` and `rotatePlayer(angle)` to mark explored tiles in `exploredGrid` and invoke `renderCartographyMap()` whenever the player's position or facing direction changes.
* **Strict `#choice-deck` Initialization & Mode Gate (`js/rpg/combat.js`, `js/rpg/character.js`):**
  * Added `syncChoiceDeckVisibility()` on `V.Combat.initialize()`, `VermisPhaseChanged`, and `V.Character.finalizeBuilder()` to guarantee `#choice-deck` remains strictly `hidden = true` during exploration and only unhides when `V.State.mode === 'AUTO_PAUSE'`.

---

### [2026-10-21 03:48 CDT] Module 02 (v1.5.2 `setActionState` Movement Fix, `.vpad-widget` Layout Editor & `#raycast-view` Loupe Clamping)
* **Fixed Virtual Movement Flag Wipe (`setActionState` in `js/engine/controls.js`):**
  * Added public `InputController.prototype.setActionState(actionName, isPressed)` to insert/remove actions inside `this.activeActions` before invoking `this.syncInputBridge()`.
* **Added Virtual Gamepad Layout Editor (`js/engine/controls.js`) & Clamped Loupe (`js/ui/ui-dragger.js`):**
  * Implemented interactive `.vpad-widget` customization (`VERMIS_PAD_LAYOUT_V1`) and clamped `#loupe-inset` strictly inside `#raycast-view`.

---

### [2026-10-20] v1.5.1 – v1.5.2 — 3-Stage Boot/Title/Menu Pipeline, Pip-Boy Boot CSS & `#hook-readout`
* Decoupled live BIOS logger (`#boot-sequence-terminal`) from `#title-screen-view` (`TITLE_SCREEN`) and `#main-menu-view` (`MAIN_MENU`).
* Integrated `#33ff33` Pip-Boy / MS-DOS boot terminal CSS, restored `#hook-readout` inside `#modal-vessel`, and added `window.addEventListener('load', ...)` module mount verification.

---

### Vermis Engine - Module 03 Changelog (Raycaster Clock Aliases, Live Cartography & Strict `#choice-deck` Gate)
**Last Updated:** October 21, 2026 (04:05 CDT)
**Module:** Module 03 (`vermis-engine/js/engine/raycaster.js`, `vermis-engine/js/rpg/character.js`, `vermis-engine/js/rpg/combat.js`)
**Notebook Source:** 🐛 Vermis Dark Fantasy Engine Laboratory

---

#### Revision History
##### [v1.5.2] - 2026-10-21 (04:05 CDT): `update(dt)` / `render(time)` Exports, Live Cartography Sync & `#choice-deck` Lock
###### Summary of Changes
* **Exported `update(dt)` & `render(time)` Master Clock Wrappers (`js/engine/raycaster.js`):**
  * Exported `VERMIS.Raycaster.update(dt)` as an alias for `updateSpatialMovement(dt)` and `VERMIS.Raycaster.render(time)` as a wrapper calling `renderDungeonGBuffer(time)` followed by `presentFallbackLitho()`, allowing `state.js` Master Clock to drive movement and 3D rendering out of the box.
* **Live `#cartography-canvas` Updates on Movement & Rotation (`js/engine/raycaster.js`):**
  * Updated `tryMovePlayer(dx, dy)` and `rotatePlayer(angle)` to mark explored tiles in `exploredGrid` and invoke `renderCartographyMap()` whenever the player's position or facing direction changes.
* **Strict `#choice-deck` Initialization & Mode Gate (`js/rpg/combat.js`, `js/rpg/character.js`):**
  * Added `syncChoiceDeckVisibility()` on `V.Combat.initialize()`, `VermisPhaseChanged`, and `V.Character.finalizeBuilder()` to guarantee `#choice-deck` remains strictly `hidden = true` (`display: none`, `pointer-events: none`) during exploration and only unhides when `V.State.mode === 'AUTO_PAUSE'`.

---

### Vermis Engine - Module 02 Changelog (Input Bridge Fix, Virtual Gamepad Editor & Bounded Loupe)
**Last Updated:** October 21, 2026 (03:48 CDT)
**Module:** Module 02 (`vermis-engine/js/engine/controls.js`, `vermis-engine/js/ui/ui-dragger.js`)
**Notebook Source:** 🐛 Vermis Dark Fantasy Engine Laboratory

---

#### Revision History
##### [v1.5.2] - 2026-10-21 (03:48 CDT): `setActionState` Movement Fix, `.vpad-widget` Layout Editor & `#raycast-view` Loupe Clamping
###### Summary of Changes
* **Fixed Virtual Movement Flag Wipe (`setActionState` in `js/engine/controls.js`):**
  * Added public `InputController.prototype.setActionState(actionName, isPressed)` to insert/remove actions inside `this.activeActions` before invoking `this.syncInputBridge()`.
  * Wired `[data-dpad]`, `#btn-touch-turn-l`, `#btn-touch-turn-r`, and the 8-way drag surface `#touch-pad-left` (`#touch-left-stick`) to `setActionState()` so `syncInputBridge()` never overwrites active virtual presses.
* **Added Virtual Gamepad Layout Editor (`js/engine/controls.js`):**
  * Implemented interactive `.vpad-widget` customization inside `#mobile-touch-deck` with `#btn-edit-vpad` toggle (`#vpad-editor-bar`), per-widget selection highlighting (`.vpad-selected`), **12px Grid-Snap vs. Free-Move** (`#btn-vpad-snap`), independent per-button size scaling from **50%–160%** (`#vpad-item-scale`), default reset (`#btn-vpad-reset`), and persistence to `localStorage` (`VERMIS_PAD_LAYOUT_V1`).
* **Clamped Diegetic Loupe to `#raycast-view` (`js/ui/ui-dragger.js`):**
  * Updated `setLoupeScreenPosition(clientX, clientY)` to clamp `#loupe-inset` strictly within the bounding rectangle of `#raycast-view`, preventing the Loupe from being dragged onto the bottom 2DS controller deck.

---

### Vermis Engine - Module 00 Changelog (Boot Pipeline, System State & Calibration)
**Last Updated:** October 20, 2026 (05:32 CDT)
**Module:** Module 00 (`vermis-engine/js/core/settings.js`, `vermis-engine/js/core/state.js`)
**Notebook Source:** 🐛 Vermis Dark Fantasy Engine Laboratory

---

#### Revision History
##### [v1.5.2] - 2026-10-20 (05:32 CDT): 3-Stage Boot/Title/Menu Flow, Raycaster Method Bridge, & Strict `#choice-deck` Gate
###### Summary of Changes
* **3-Stage Boot -> Dramatic Title -> Clean Main Menu (`js/core/state.js`):**
  * Separated the startup flow into `BOOT` (live Pip-Boy/MS-DOS character-by-character terminal in `#boot-sequence-terminal`) -> `TITLE_SCREEN` (dramatic title plate in `#title-screen-view`, hiding the boot logger) -> `MAIN_MENU` (`#main-menu-view` clean directive menu with zero BIOS log text visible).
* **Dual-API Raycaster & Shader Clock Bridge (`js/core/state.js`):**
  * Updated `startMasterClock()` (and aliased `startEngineLoop()`) to invoke `V.Raycaster.update(dt)` or fall back to `V.Raycaster.updateSpatialMovement(dt)`, and to call `V.Raycaster.render(quantizedTime, stepInterval)` or fall back to `V.Raycaster.renderDungeonGBuffer(quantizedTime)` + `V.Raycaster.presentFallbackLitho()`.
* **Strict Phase Synchronization & `#choice-deck` Lock (`js/core/state.js`):**
  * `setPhaseView(phaseName)` now synchronizes `V.State.currentPhase = phaseName`, resets `V.State.mode = 'SPATIAL_HUNT'` when entering `SPATIAL_HUNT`, and forces `#choice-deck` to remain strictly `hidden = true` (`pointerEvents = 'none'`) in all phases except `AUTO_PAUSE`.
* **Strict ES5 & Zero-Inline-HTML Compliance (`js/core/state.js`, `js/core/settings.js`):**
  * Refactored all Module 00 functions to strict ES5 (`var`, `function`) with pure DOM node creation (`createTextNode`, `textContent`) and added Multi-Pane Preferences tab/slider hooks in `settings.js`.

---

# VERMIS ENGINE // MASTER CHANGELOG

## [2026-10-20] v1.5.2 — 3-Stage Boot/Title/Menu Pipeline, Per-Button Virtual Pad Editor, 100dvh 2DS Fit & Movement Sync

### 1. 3-Stage Boot -> Dramatic Title -> Clean Main Menu (`index.html`, `js/core/state.js`)
* **Decoupled Live BIOS Logger from Main Menu:** `#boot-sequence-terminal` now acts strictly as a live Pip-Boy/MS-DOS module mounting screen (`BOOT` phase).
* **Dramatic Title Screen (`#title-screen-view`):** Once all external `.js` modules finish mounting, the BIOS terminal hides completely and transitions to a stark *Vermis* Lithography Title Screen (`TITLE_SCREEN` phase) before entering a clean `#main-menu-view` (`MAIN_MENU` phase) with zero diagnostic log clutter.

### 2. Per-Button Virtual Gamepad Placement, Grid-Snap & Independent Scale Editor (`index.html`, `js/engine/controls.js`)
* **Individual Widget Customization (`.vpad-widget`):** Every virtual control (`move_pad`, `look_pad`, `btn_a`, `btn_b`, `slot_q`, `slot_e`, `turn_l`, `turn_r`, `loupe_btn`) is now independently positioned and scaled inside `#mobile-touch-deck`.
* **Interactive `[EDIT PAD]` Mode (`#vpad-editor-bar`):** Tapping `EDIT PAD` enables an interactive layout editor with **12px Grid-Snap vs. Free-Move** toggling, per-button independent scale slider (`50%–160%`), Reset to Default, and automatic `localStorage` persistence (`VERMIS_PAD_LAYOUT_V1`).

### 3. 100dvh 2DS Split-Screen Fit (`index.html`, `css/brutalist-ui.css`)
* **Zero-Scroll Viewport Allocation:** Locked `#monitor-bezel` and `#screen` to `100dvh` (`overflow: hidden`), set `#gameplay-stage` to `flex: 1 1 0`, collapsed `#terminal-deck` to a single 1-line status bar by default, and fixed `#mobile-touch-deck` to `175px` so the 3D viewport and virtual controller fit simultaneously on mobile screens.
* **Strict `#choice-deck` Gate:** `#choice-deck` remains strictly `hidden` during `SPATIAL_HUNT` and only opens during `AUTO_PAUSE` interrupts.

### 4. Spatial Movement & Cartography Synchronization (`js/core/state.js`, `js/engine/controls.js`, `js/engine/raycaster.js`)
* **`activeActions` Input Bridge:** Virtual D-Pad, Turn buttons, and Touchpad now write directly into `VERMIS.inputMap.activeActions` so `syncInputBridge()` preserves movement flags across frames.
* **Master Clock Phase Sync:** `V.UI.setPhaseView()` now synchronizes `V.State.currentPhase` and `V.State.mode`, ensuring `startMasterClock()` continuously steps `V.Raycaster.updateSpatialMovement(dt)` and refreshes `renderCartographyMap()`.

---

# Vermis Engine - Module 01 Changelog (The Shell & UI Framing)
**Last Updated:** October 20, 2026 (00:41 CDT)  
**Module:** Module 01 (`vermis-engine/index.html`, `vermis-engine/css/brutalist-ui.css`, `vermis-engine/css/crt-shaders.css`, `vermis-engine/directory.md`)  
**Notebook Source:** 🐛 [Vermis Dark Fantasy Engine Laboratory](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

## Revision History

### [v1.5.1] - 2026-10-20 (00:41 CDT): Clean Up of `index_2.html` -> `index.html`, Pip-Boy Boot CSS, & `#hook-readout` Verification Block
#### Summary of Changes
- **Integrated Pip-Boy / MS-DOS Boot Terminal CSS (`index.html`):**
  - Replaced the older `.bios-box`, `.bios-header`, `.bios-log`, and `.cursor-blink` inline styles with the exact `#33ff33` phosphor terminal styling (`padding: 20px`, `text-shadow: 0 0 5px #33ff33`, `border-bottom: 2px solid #33ff33`, and `@keyframes blink { 50% { opacity: 0; } }`).
- **Restored `#hook-readout` DOM Container & Added `window.addEventListener('load', ...)` Verification Block (`index.html`):**
  - Added the `<div id="hook-readout"></div>` diagnostic container inside `#modal-vessel` (`ENGINE HOOKS` block) so `#hook-readout` is never `null`.
  - Integrated the exact `window.addEventListener('load', ...)` module verification script checking `mod2Active` (`v.Shader || v.inputMap`), `mod3Active` (`v.Raycaster || v.State`), and `mod4Active` (`v.Bestiary && Object.keys(v.Bestiary).length > 0`), outputting the live status to `#hook-readout`, and force-booting `v.State.startEngineLoop()` (`window._vermisBooted = true`).
  - Synced the sequential module loader completion callback with `#hook-readout` so dynamically mounted scripts (`loadModuleAt`) immediately update `STANDBY` to `ACTIVE` once all fallback paths finish probing.
- **Cleaned Up Inline Script Bloat & Added `startEngineLoop` Alias (`index.html`):**
  - Streamlined the inline script in `index_2.html` (`v1.5.0` -> `v1.5.1`), aliasing `V.State.startEngineLoop` to `V.Engine.triggerEngineLoop` if `state.js` has not yet defined it, and adding `js/ui/controls.js` to the sequential loader fallback chain to match `directory.md` (`v1.4.1`).

---

### [v1.5.0] - 2026-10-19: 2DS Handheld Controller Deck, Multi-Pane Preferences, & Pip-OS Sequential Loader
#### Summary of Changes
- Structured the 2DS / Handheld vertical flex column (`#raycast-view` top screen, collapsible `#terminal-deck` middle bar, and `.touch-deck-2ds` bottom virtual controller with swappable 8-Way Stick, Classic Game Boy D-Pad, and Dual Touchpad modes).
- Added Multi-Pane Preferences modal (`1. DISPLAY`, `2. CONTROLS`, `3. DIFFICULTY`, `4. GRAPHICS/AUDIO`) with brightness/contrast/gamma sliders and 2DS deck button scaling.

---

### [v1.4.1] - 2026-10-19 (11:52 CDT): Directory & Module Allocation Map Update (`directory.md`)
#### Summary of Changes
- Added `js/core/settings.js` (Module 00) for Difficulty Scaling (`UNFORGIVING 1.0x`, `MISERABLE 1.5x`, `DOOMED 2.0x`), New Game Preferences Walkthrough Wizard, Plate/CRT/FPS calibration, and the strict default Gyroscopic sensor lock (`GYRO: OFF [LOCKED]`).
- Reconciled Module 00, 01, 02, 03, & 04 responsibilities across `state.js`, `character.js`, `lithography.js`, `raycaster.js`, `billboard.js`, `controls.js`, `ui-dragger.js`, `combat.js`, and `stench_champion.js`.

---

### [v1.4.0] - 2026-10-19 (07:10 CDT): Code Audit & Dedicated JS Hook Architecture Patch (`index.html`)
#### Summary of Changes
- Audited uploaded `index.html`, `brutalist-ui.css`, and `crt-shaders.css`; removed duplicate `<script>` tags for `state.js` and `character.js`; restored stripped modal DOM hooks; and established a single ordered `<script>` hook block delegating all non-UI logic to Modules 00–04.

---

### [v1.0 – v1.3.4] - 2026-10-18: Initial Shell, Dormant Gyro Lock, GPU Shaders, & Unified Pointer Events
#### Summary of Changes
- Established `vermis-engine/` directory structure, locked-off-by-default Gyro sensor (`GYRO: OFF [LOCKED]`), draggable `#loupe-inset` cipher decrypter, togglable `.dos-modal` windows, and HTML5 Pointer Events dragging.

---

##### Vermis Engine - Module 04 Changelog (The Bestiary: Procedural Skeletal Rigs & G-Buffer Draw Calls)
**Date:** October 19, 2026
**Module:** Module 04 (`js/bestiary/stench_champion.js`, `js/bestiary/light_gobbler.js`, `js/bestiary/marionette.js`)
**Author:** Engineering / Architecture Log

###### Summary of Changes
* **Strict Module 04 Scope Alignment (`directory.md` v1.4.1):**
  * Populated `js/bestiary/` with three self-contained procedural anatomical rigs registered on `window.VERMIS.Bestiary` for offline `file://` execution without CORS errors.
  * Standardized the `renderRig(targetCtx, t, dt, opts)` interface across all Bestiary entities so `js/engine/billboard.js` (Module 03) can composite live 320x400 offscreen G-Buffers directly against the DDA raycaster's perpendicular `zBuffer`.
* **The Stench Champion (`js/bestiary/stench_champion.js`):**
  * Ported the *Catacombs Exit* multi-corpse skeletal rig with three asynchronous respiratory oscillators, 16-segment twin centipede vertebral arches, catenary sinew strands, and breeze-deflected miasma spores.
  * Wired `DORMANT`, `AGGRO`, `TELEGRAPH` (1.5s cleaver raise + nerve spasm impulse), and `IMPACT` poses with `Infection` Complication metadata.
* **The Light Gobbler (`js/bestiary/light_gobbler.js`):**
  * Built the photophobic subterranean stalker featuring a translucent rib-caged gullet housing a flickering swallowed lantern core (`G = 218`), 4 arachnid-humanoid stalking limbs, and a split pharyngeal maw that distends during the 1.5s `TELEGRAPH` window.
  * Encoded 6 Spectral Parasite Weak-Point Nodes and light-drain motes at Material ID `G >= 245` so they remain cloaked in darkness until scanned by the player's draggable **Diegetic Loupe (`#loupe-canvas`)**.
* **Pale Swordsman Marionette (`js/bestiary/marionette.js`):**
  * Built *The Puppet Without Strings* using quantized mechanical step-ticks (`Math.floor(t * 4.0) / 4.0`), pendulum rafter suspension, cracked porcelain armor plates (`G = 155`), a weeping crimson eye slit (`G = 220`), and unseen celestial puppet threads (`G = 246`) revealed via the Spectral Loupe X-Ray pass.

---

### Vermis Engine - Module 03 Changelog (RPG Math, RTwP Combat, Dragger & Billboards)
**Last Updated:** October 19, 2026 (18:31 CDT)
**Module:** Module 03 (`js/rpg/character.js`, `js/rpg/combat.js`, `js/ui/ui-dragger.js`, `js/engine/billboard.js`)
**Author:** Engineering / Architecture Log

---

#### Revision History
##### [v1.4.1] - 2026-10-19 (18:31 CDT): Directory Manifest Scope Alignment & Full RPG/Pointer Pipeline Upgrade
###### Summary of Changes
* **Reconciled Module 03 File Scope (`directory.md` v1.4.1):**
  * Scoped Module 03 strictly to `js/rpg/character.js`, `js/rpg/combat.js`, `js/ui/ui-dragger.js` (dual-path compatible with `js/ui-dragger.js`), and `js/engine/billboard.js`.
* **6-Stage Dirty-Flag Stat Pipeline & Decay Portrait (`js/rpg/character.js`):**
  * Upgraded `recalculatePipeline()` to evaluate Base 20-Point Allocation -> Paper-Doll Gear Modifiers -> Unique-ID Active Buffs -> Complication Trauma Penalties -> Adrenaline/Exhaustion Modifiers -> `[0..12]` Clamping.
  * Added reverse-order array traversal in `tickTimers(dt)` to expire buffs safely and added procedural `#decay-portrait-canvas` mutation rendering inside `#modal-vessel`.
  * Added dual-selector compatibility (`#characteristics-list` / `#stat-list-char` and `#disciplines-list` / `#stat-list-disc`) plus custom lifecycle listeners (`VermisCreationPhaseEntered`, `VermisDoomedSeedRequested`, `VermisModalOpened`).
* **RTwP Action-Recovery, Re-Entrancy Locks & Solace/Malignancy Economy (`js/rpg/combat.js`):**
  * Replaced the prototype stub with `window.VERMIS.Combat`, enforcing dual-layer choice re-entrancy locks (`V.State.isProcessingChoice = true` and `choiceDeck.style.pointerEvents = 'none'`).
  * Wired 1:1 `Solace -> Malignancy` transfers (`spendSolace()`), escalating Labyrinth Rot Tiers (1–4) and triggering the 10-second Adrenaline Inverse Death Spiral upon accepting Complication impacts.
* **Unified HTML5 Pointer Events & Paper-Doll AABB Capacity Math (`js/ui/ui-dragger.js`):**
  * Replaced legacy mouse/touch listeners with `pointerdown`, `pointermove`, `pointerup`, and `setPointerCapture`, clamping `#loupe-inset` strictly inside `#screen`.
  * Added AABB Paper-Doll equipment drop-zone collision and strict spatial weight validation (`zoneCapacity - currentUsedSlots >= itemWeight`) plus Strategy Guide inspector hotkey bindings (`[Q]` / `[E]`).
* **Decoupled 3D Billboard Projection & 1.5s Telegraph AI (`js/engine/billboard.js`):**
  * Connected `LabyrinthEntity` 1.5s Telegraph impacts directly to `VERMIS.Combat.triggerAutoPauseInterrupt()` and Difficulty Scalars (`1.0x`, `1.5x`, `2.0x`), encoding Spectral Hidden entities at `G = 242` for the Module 02 Loupe X-Ray pass.

---

### Vermis Engine - Module 02 Changelog (Lithography Shader, Controls & Raycaster Reconciliation)
**Last Updated:** October 19, 2026 (12:32 CDT)
**Module:** Module 02 (`js/core/lithography.js`, `js/ui/controls.js`, `js/engine/raycaster.js`)
**Author:** Engineering / Architecture Log

---

#### Revision History
##### [v1.4.1] - 2026-10-19 (12:32 CDT): Directory Manifest Scope Alignment & Input/G-Buffer Bridge Patch
###### Summary of Changes
* **Reconciled Module 02 File Scope (`directory.md` v1.4.1):**
  * Scoped Module 02 strictly to `js/core/lithography.js`, `js/ui/controls.js` (dual-path compatible with `js/controls.js`), and `js/engine/raycaster.js`.
  * Delegated `js/ui/ui-dragger.js` (Diegetic Loupe DOM dragger, `.corrupt-cipher` decrypter, and Paper-Doll AABB capacity math) exclusively to **Module 03.1**.
* **Input Bridge Synchronization (`js/ui/controls.js`):**
  * Added `syncInputBridge()` to `VERMIS.inputMap` so active actions expose live boolean flags (`ACTION_MOVE_FORWARD`, `ACTION_STRAFE_LEFT`, `ACTION_TURN_LEFT`, etc.), `mouseDeltaX`, and a synchronized `keyBindings` dictionary for `raycaster.js` and `#remap-modal` in `index.html`.
  * Upgraded mobile virtual joystick (`#touch-left-stick`) and swipe camera (`#touch-right-look`) to the unified HTML5 Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `setPointerCapture`).
* **Shared G-Buffer Raycast Compositing & Trigger Pre-Invalidation (`js/engine/raycaster.js` & `js/core/lithography.js`):**
  * Tagged 3D DDA raycast floor, ceiling, and masonry pixels in `#gbuffer-debug-canvas` with `alpha = 64` so `LithographyShader.renderPass()` composites foreground Bestiary rigs (`alpha >= 95`) and stippled drop-shadows directly onto the live 3D labyrinth walls.
  * Added `spatialTriggers` with strict `tile.consumed = true` pre-invalidation upon tile entry and `renderCartographyMap()` for `#cartography-canvas`.

---

### Vermis Engine - Module 00 Changelog (Boot Pipeline, System State & Calibration)
**Last Updated:** October 19, 2026 (12:21 CDT)
**Module:** Module 00 (`vermis-engine/js/core/settings.js`, `vermis-engine/js/core/state.js`)
**Notebook Source:** 🐛 Vermis Dark Fantasy Engine Laboratory

--------------------------------------------------------------------------------

#### Revision History
##### [v1.4.1] - 2026-10-19 (12:21 CDT): Directory Manifest & Module Registry Alignment
###### Summary of Changes
* **Scoped Module 00 Strictly to `js/core/settings.js` & `js/core/state.js`:**
  * Decoupled `js/rpg/character.js` (reassigned to Module 03) from Module 00 using `CustomEvent` hooks (`VermisPhaseChanged`, `VermisModalOpened`, `VermisCreationPhaseEntered`, `VermisDoomedSeedRequested`, and `VermisDifficultyChanged`) alongside `VERMIS.UI` delegation.
* **Resolved `<script defer>` Load-Order Dependency (`settings.js` -> `state.js`):**
  * Added safe baseline initialization for `VERMIS.Config` and `VERMIS.bindAction` (with per-event `dataset.vermisBound_<event>` guards) in both `settings.js` and `state.js` to match the v1.4.0 `index.html` script hook order.
* **Integrated Quantized Master Game Clock (`js/core/state.js`):**
  * Added `VERMIS.State.startMasterClock()` to drive real-time spatial updates (`Raycaster.update`, `Combat.updateRecovery`) exclusively in Mode A (`SPATIAL_HUNT`) while stepping `Raycaster.render`, `Billboard.render`, and `Shader.executePass` at the configured cadence (`12`, `24`, or `60` FPS).
* **Enforced Strict Gyroscopic Sensor Lock (`js/core/settings.js`):**
  * Added `enforceGyroLock()` and bindings for both `#btn-gyro` and `#btn-gyro-modal` (`GYRO: OFF [LOCKED]`) plus phase-bleed visibility guards on `#loupe-inset`.


---

# Vermis Engine - Module 01 Changelog (The Shell & UI Framing)
**Last Updated:** October 19, 2026 (07:10 CDT)  
**Module:** Module 01 (`vermis-engine/index.html`, `vermis-engine/css/brutalist-ui.css`, `vermis-engine/css/crt-shaders.css`)  
**Notebook Source:** 🐛 [Vermis Dark Fantasy Engine Laboratory](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

## Revision History

### [v1.4.0] - 2026-10-19 (07:10 CDT): Code Audit & Dedicated JS Hook Architecture Patch (`index.html`)
#### Summary of Changes
- **File Audit of Uploaded `index.html`, `brutalist-ui.css`, & `crt-shaders.css`:**
  - Verified the streamlined `.full-width-viewport` 3D stage (`#gameplay-stage`), phase-bleed `hidden` guards on `#in-game-hud` / `#terminal-deck` / `#loupe-inset`, and the CSS orphan purge in `brutalist-ui.css`.
- **Fixed Duplicate Script Loading Bug (`index.html`):**
  - Removed the duplicate `<script>` block at the bottom of `index.html` that was loading `js/core/state.js` and `js/rpg/character.js` twice (once with `defer` and once synchronously), eliminating state overwrites and double event-listener registration.
- **Unified Dedicated JS Hook Block (`index.html`):**
  - Created a single, ordered `<script defer>` hook section organized by module:
    - **Module 00:** `js/core/settings.js`, `js/core/state.js`
    - **Module 02:** `js/core/lithography.js`, `js/engine/controls.js` (fallback `js/controls.js`), `js/engine/raycaster.js`
    - **Module 02.1 & 03.1:** `js/ui/ui-dragger.js` (fallback `js/ui-dragger.js`)
    - **Module 03 & 03.2:** `js/rpg/character.js`, `js/rpg/combat.js`, `js/engine/billboard.js`
    - **Module 04:** `js/bestiary/stench_champion.js`
- **Restored Stripped Modal DOM Hooks (`index.html`):**
  - Re-added `.diff-selector-grid` (`UNFORGIVING 1.0x`, `MISERABLE 1.5x`, `DOOMED 2.0x`), `#btn-fps-modal`, and `#btn-gyro-modal` inside `#preferences-modal`; `#remap-prompt` inside `#remap-modal`; `#decay-portrait-canvas` and `#active-buff-list` inside `#modal-vessel`; and `#guide-inspector-stats`, `#btn-bind-item-q`, `#btn-bind-item-e`, and `#btn-use-inspect-item` inside `#modal-inventory`.
- **Pure UI Delegation Controller (`VERMIS.UI`):**
  - Kept `index.html` strictly focused on DOM/modal switching and custom event dispatching (`VermisPhaseChanged`, `VermisModalOpened`, `VermisCreationPhaseEntered`, `VermisDoomedSeedRequested`), delegating all RPG math, sensor locks, and raycasting logic to their dedicated modules.

---

### [v1.3.3 – v1.3.4] - 2026-10-18 / 2026-10-19: CSS Orphan Purge & GPU Shader Passes
#### Summary of Changes
- Purged orphaned `.stone-inset` and `.upper-stage-3col` rules from `css/brutalist-ui.css` in favor of the streamlined `.full-width-viewport` layout and `.dos-modal` pop-up windows.
- Bound `#vermis-litho-Warp`, `#vermis-loupe-spectral`, `#vermis-trauma-aberration`, and `.cr-monitor-bezel.booting` CRT warmup keyframes in `css/crt-shaders.css`.


---

# Vermis Engine - Module 01 Changelog (The Shell & UI Framing)
**Last Updated:** October 18, 2026 (18:01 CDT)  
**Module:** Module 01 (`vermis-engine/index.html`, `vermis-engine/css/brutalist-ui.css`, `vermis-engine/css/crt-shaders.css`)  
**Notebook Source:** 🐛 [Vermis Dark Fantasy Engine Laboratory](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

## Revision History

### [v1.3.4] - 2026-10-18 (18:01 CDT): Single-File Patch — `vermis-engine/css/crt-shaders.css`
#### Summary of Changes (Focused File Patch: `vermis-engine/css/crt-shaders.css`)
- **GPU SVG Filter Bindings:**
  - Bound `#vermis-litho-Warp` paper-grain turbulence to `#visual-stage-canvas`, `#decay-portrait-canvas`, and `#guide-inspector-canvas`.
  - Bound `#vermis-loupe-spectral` high-contrast X-ray inversion to `#loupe-canvas` inside the draggable Diegetic Loupe.
  - Bound `#vermis-trauma-aberration` chromatic phosphor split to high-trauma (`.trauma-critical`, `.rot-tier-4`) and Mode B Auto-Pause interrupt states.
- **Module 00 CRT Warmup & BIOS Phosphor Power-On:**
  - Added `.cr-monitor-bezel` and `.booting` CRT cathode-tube warmup keyframes (`@keyframes crt-tube-warmup` and `@keyframes bios-scan-sweep`) to support `VERMIS.State.initializeSystem()` in `js/core/state.js`.
- **Skeuomorphic Canvas & Automap Phosphor Passes:**
  - Enforced crisp pixelated rendering, glass curvature highlights (`.loupe-frame::after`), and vignette framing across `#decay-portrait-canvas`, `#automap-canvas`, `#cartography-canvas`, and `#guide-inspector-canvas`.
- **Corrupted Cipher Squirm & Decrypted Stabilization:**
  - Enhanced `.corrupt-cipher` with `@keyframes cipher-squirm` and added `.corrupt-cipher[data-revealed="true"]` styling so ciphers visibly stabilize in CRT green when decrypted by the draggable Diegetic Loupe (`#loupe-inset` / `js/ui-dragger.js`).
- **Plate-Specific Scanline & Phosphor Glow Overrides:**
  - Tuned scanline grating opacity, vignette depth, and phosphor text bloom across `.palette-catacombs`, `.palette-flutewoods`, and `.palette-brutalist`, with full support for the `#btn-crt` hardware bypass toggle.

---

### [v1.3.3] - 2026-10-18 (17:47 CDT): Single-File Patch — `vermis-engine/css/brutalist-ui.css`
#### Summary of Changes (Focused File Patch: `vermis-engine/css/brutalist-ui.css`)
- **Global `[hidden]` & Re-Entrancy CSS Safeguards:**
  - Enforced strict `[hidden] { display: none !important; }` rules across `.dos-modal`, `.phase-screen`, `.touch-deck-overlay`, `#choice-deck`, and `#modal-backdrop`.
- **Frame-Bound Skeuomorphic HUD, Paper-Doll Grid & Boot Pipeline Styling:**
  - Styled `#boot-sequence-terminal`, `#intro-cutscene-view`, `#builder-view`, `#skeuomorphic-frame`, `.stone-inset` flickering torchlight wings (`@keyframes torch-flicker-stone`), `#portrait-frame`, `.automap-frame`, `#instant-hotbar`, and `.paper-doll-layout` with `.parchment-bg` Strategy Guide inspection panes.

---

### [v1.3.2] - 2026-10-18 (16:59 CDT): Single-File Patch — `vermis-engine/index.html` Master Consolidation
#### Summary of Changes (Focused File Patch: `vermis-engine/index.html`)
- **Sequential Boot Pipeline, Frame-Bound Skeuomorphic DOM & Module 03.2 State Gates:**
  - Consolidated `#boot-sequence-terminal`, `#preferences-modal` setup walkthrough wizard (`UNFORGIVING 1.0x`, `MISERABLE 1.5x`, `DOOMED 2.0x`), `#intro-cutscene-view`, 20-Point Buy `#builder-view`, 3-column `#skeuomorphic-frame`, `#modal-inventory` Paper-Doll AABB drop zones, `tile.consumed = true` pre-invalidation, `isProcessingChoice` re-entrancy locks, Unique-ID `applyBuff()` duration refresh rules, `syncInputBridge()`, and locked-off-by-default Gyro (`GYRO: OFF [LOCKED]`).

---

# Vermis Engine - Module 01 Changelog (The Shell & UI Framing)
**Last Updated:** October 18, 2026 (17:47 CDT)  
**Module:** Module 01 (`vermis-engine/index.html`, `vermis-engine/css/brutalist-ui.css`, `vermis-engine/css/crt-shaders.css`)  
**Notebook Source:** 🐛 [Vermis Dark Fantasy Engine Laboratory](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

## Revision History

### [v1.3.3] - 2026-10-18 (17:47 CDT): Single-File Patch — `vermis-engine/css/brutalist-ui.css`
#### Summary of Changes (Focused File Patch: `vermis-engine/css/brutalist-ui.css`)
- **Global `[hidden]` & Re-Entrancy CSS Safeguards:**
  - Enforced strict `[hidden] { display: none !important; }` rules across `.dos-modal`, `.phase-screen`, `.touch-deck-overlay`, `#choice-deck`, and `#modal-backdrop` so flex/grid containers never override HTML `hidden` states on mobile or desktop browsers.
- **Sequential Boot, Walkthrough & 20-Point Builder Styling:**
  - Styled `#boot-sequence-terminal` (`.bios-box`, `.bios-log`, `.main-menu-hub`, `.boot-options`), `#intro-cutscene-view` (`.cutscene-plate`, `.cutscene-border`), and the 20-Point Buy `#builder-view` (`.builder-grid-2`, `.builder-card`, `.stat-stepper`, `.brutalist-select`).
- **Frame-Bound Skeuomorphic HUD & Flickering Torchlight Wings:**
  - Styled `#skeuomorphic-frame` and `#upper-stage-container.upper-stage-3col` (`205px 1fr 215px`) to constrain the central 3D raycast stage (`#raycast-view`) between recessed `.stone-inset` wings (`#left-stone-wing`, `#right-stone-wing`) featuring grooved masonry borders and `@keyframes torch-flicker-stone` inner/outer box-shadow illumination.
- **Vessel Decay Portrait, 2D Automap & Instant Hotbar:**
  - Styled `#portrait-frame`, `#decay-portrait-canvas`, `.sigil-strip` (`.status-sigil.active`), `.wing-vitals-box`, `.automap-frame` (`#automap-canvas`), `#instant-hotbar` (`.hotkey-slot`, `.hotkey-strike`), and `#active-buff-list` (`.buff-pill`).
- **Paper-Doll Spatial Inventory & Strategy Guide Parchment Inspector:**
  - Styled `.paper-doll-layout`, `.grid-bag`, `.paper-doll-item` (with `touch-action: none` for unified Pointer Events dragging), `#vessel-wireframe` `.equip-slot` drop zones, and the `.parchment-bg` *Vermis* Strategy Guide inspection pane (`#strategy-guide-inspector`).
- **Mobile Touch Deck, Draggable Loupe & Dormant Gyro Indicators:**
  - Styled the 8-way octagonal virtual joystick (`.stick-octa-ring`, `.stick-nub`), mobile Loupe override center zone (`.touch-zone-center`), `.loupe-frame.dragging`, and dashed `.ui-btn.gyro-disabled` styling (`GYRO: OFF [LOCKED]`).

---

### [v1.3.2] - 2026-10-18 (16:59 CDT): Single-File Patch — `vermis-engine/index.html` Master Consolidation
#### Summary of Changes (Focused File Patch: `vermis-engine/index.html`)
- **Sequential Boot & Initialization DOM Pipeline (`BOOT` -> `MAIN_MENU` -> `PREFERENCES_WALKTHROUGH` -> `INTRO` -> `CREATION` -> `SPATIAL_HUNT`):**
  - Embedded `#boot-sequence-terminal`, `#preferences-modal` setup walkthrough wizard (`UNFORGIVING 1.0x`, `MISERABLE 1.5x`, `DOOMED 2.0x`), `#intro-cutscene-view`, and the 20-Point Buy `#builder-view` overlay.
- **Frame-Bound Skeuomorphic HUD (`#skeuomorphic-frame` & `#upper-stage-container`):**
  - Structured the 3-column diegetic upper stage with `#decay-portrait-canvas`, `#visual-stage-canvas`, `#automap-canvas`, and `#instant-hotbar`.
- **Paper-Doll Spatial Inventory & Module 03.2 State Gates:**
  - Implemented `#modal-inventory` AABB drop zones, `tile.consumed = true` pre-invalidation, `isProcessingChoice` + `pointerEvents = 'none'` re-entrancy locks, Unique-ID `applyBuff()` duration refresh rules, and `syncInputBridge()`.

---

### [v1.1 – v1.3.1] - 2026-10-18: Gyroscopic Lock, Togglable Modals, & Unified Pointer Events
#### Summary of Changes
- Added opt-in `window.VERMIS.GyroEngine` (`GYRO: OFF [LOCKED]` by default), draggable `#loupe-inset` cipher decrypter, togglable `.dos-modal` windows, and Cross-Module Input/DOM Bridge.

---

### [v1.0] - 2026-10-18: Initial Module 01 Shell Architecture
#### Summary of Changes
- Established `vermis-engine/` directory structure (`index.html`, `css/brutalist-ui.css`, `css/crt-shaders.css`).

---

# Vermis Engine - Module 01 Changelog (The Shell & UI Framing)
**Last Updated:** October 18, 2026  
**Module:** Module 01 (`vermis-engine/index.html`, `vermis-engine/css/brutalist-ui.css`, `vermis-engine/css/crt-shaders.css`)  
**Notebook Source:** 🐛 [Vermis Dark Fantasy Engine Laboratory](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

## Revision History

### [v1.3.2] - 2026-10-18: Single-File Patch — `vermis-engine/index.html` Master Consolidation
#### Summary of Changes (Focused File Patch: `vermis-engine/index.html`)
- **Sequential Boot & Initialization DOM Pipeline (`BOOT` -> `MAIN_MENU` -> `PREFERENCES_WALKTHROUGH` -> `INTRO` -> `CREATION` -> `SPATIAL_HUNT`):**
  - Embedded `#boot-sequence-terminal` with BIOS POST diagnostics and Main Menu options (`[1] NEW GAME`, `[2] LOAD GAME`, `[3] PREFERENCES`, `[4] DIRECT SPATIAL HUNT`).
  - Added context-aware `#preferences-modal` supporting both standalone mid-game settings toggling and the New Game setup walkthrough wizard with Difficulty Modifiers (`UNFORGIVING 1.0x`, `MISERABLE 1.5x`, `DOOMED 2.0x`), Lithography Plate cycling, Cadence selection, CRT Scanline toggle, and the locked-off-by-default Gyroscopic Sensor toggle (`GYRO: OFF [LOCKED]`).
  - Integrated `#intro-cutscene-view` narrative pacing screen and the 20-Point Buy `#builder-view` Character Creation & *"Doomed Seed"* randomizer overlay.
- **Frame-Bound Skeuomorphic HUD (`#skeuomorphic-frame` & `#upper-stage-container`):**
  - Structured the 3-column diegetic upper stage: Left Stone Wing (`#left-stone-wing.stone-inset`) housing the procedural mutating *DOOM*-style Vessel Decay Portrait (`#decay-portrait-canvas` + `#decay-portrait`), cryptic status sigils, and Solace/Malignancy/Complication counters; Center Raycast Stage (`#raycast-view`) housing `#visual-stage-canvas` (320×400), `#gbuffer-debug-canvas`, and `#mobile-touch-deck` with `#btn-touch-loupe`; Right Stone Wing (`#right-stone-wing.stone-inset`) housing the 2D `#automap-canvas` (112×112), `#instant-hotbar` (`[Q]`, `[E]`, `[LMB/RT]`), and Unique-ID active buff list (`#active-buff-list`).
- **Paper-Doll Spatial Inventory & Strategy Guide Inspector (`#modal-inventory`):**
  - Replaced flat inventory lists with `.paper-doll-layout`, combining draggable `.grid-bag` items, `#vessel-wireframe` `.equip-slot` AABB drop zones with spatial weight capacity validation (`zoneCapacity - currentUsedSlots >= itemWeight`), and a `.parchment-bg` *Vermis* Strategy Guide lore inspector pane.
- **Module 03.2 State Gates, Spatial Trigger Consumption & Re-Entrancy Locks:**
  - Enforced `tile.consumed = true` pre-execution invalidation on spatial triggers, `VERMIS.State.isProcessingChoice` + `choiceDeck.style.pointerEvents = 'none'` re-entrancy locks on `#choice-deck`, and Unique-ID `applyBuff()` duration refresh rules.
- **Cross-Module Input/DOM Bridge & Dual-Path Script Loader:**
  - Added `syncInputBridge()` to bridge Module 02 (`InputController` in `js/controls.js`) and Module 03 (`js/core/state.js`, `js/engine/raycaster.js`, `js/engine/billboard.js`), and configured dual-path fallback script loaders for offline `file://` execution.

---

### [v1.2 – v1.3.1] - 2026-10-18: Skeuomorphic HUD, Togglable Modals, & Unified Pointer Events
#### Summary of Changes
- Added global `[hidden] { display: none !important; }` safeguard to prevent CSS flex rules from overriding HTML `hidden` attributes on mobile browsers.
- Refactored Character Sheet (`#modal-vessel`), Inventory (`#modal-inventory`), Cartography (`#modal-map`), Keybinder (`#remap-modal`), and Preferences (`#preferences-modal`) into togglable `.dos-modal` overlays with `#modal-backdrop` tap-to-close support.
- Abstracted draggable UI interactions (`#loupe-inset` and Paper-Doll items) to the unified HTML5 Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `setPointerCapture`).

---

### [v1.1] - 2026-10-18: Gyroscopic Compatibility (Disabled by Default), Draggable Loupe, & Module 02 Hook Synchronization
#### Summary of Changes
- Integrated hardware `DeviceOrientationEvent` API support (`window.VERMIS.GyroEngine`) into `index.html` with iOS 13+ `requestPermission()` handshake and 3.5-degree deadzone filtering, strictly locked OFF by default (`GYRO: OFF [LOCKED]`).
- Upgraded `#loupe-inset` / `#loupe-canvas` into a screen-wide draggable inspection tool capable of decoding `.corrupt-cipher` telemetry spans.
- Added `window.VERMIS.inputMap`, `#remap-modal`, `#modular-hotkey-bar`, and `#mobile-touch-deck`.

---

### [v1.0] - 2026-10-18: Initial Module 01 Shell Architecture
#### Summary of Changes
- Established `vermis-engine/` directory structure (`index.html`, `css/brutalist-ui.css`, `css/crt-shaders.css`).
- Created 320×400 `#visual-stage-canvas`, `#loupe-canvas`, cognitive HUD elements, and `#rolling-telemetry-deck` with `[1]`–`[4]` choice directives.

---

# Vermis Engine - Module 01 Changelog (The Shell & UI Framing)
**Last Updated:** October 18, 2026  
**Module:** Module 01 (`index.html`, `css/brutalist-ui.css`, `css/crt-shaders.css`)  
**Notebook Source:** 🐛 [Vermis Companion](https://gemini.google.com/notebook/5af8c9eb-f7ab-4ea4-b642-82152c89ce04)

---

## Revision History

### [v1.1] - 2026-10-18: Gyroscopic Compatibility (Disabled by Default), Draggable Loupe, & Module 02 Hook Synchronization
#### Summary of Changes
- **Gyroscopic Hardware Compatibility (Disabled by Default):**
  - Integrated hardware `DeviceOrientationEvent` API support (`window.VERMIS.GyroEngine`) into `index.html`, complete with iOS 13+ `requestPermission()` handshake, alpha/beta/gamma tilt normalization, deadzone filtering (`3.5°`), and camera/breeze vector hooks.
  - Set `window.VERMIS.Config.gyroEnabled = false` by default to preserve the heavy, claustrophobic 1990s MS-DOS aesthetic. Added a dedicated `#btn-gyro` status toggle in the top chassis bar (`GYRO: OFF [LOCKED]`) that stays disabled by default unless explicitly unlocked for hardware diagnostics.
- **Tactile Draggable Loupe (`#loupe-inset` / `#loupe-canvas`):**
  - Upgraded the circular loupe in `index.html` and `css/brutalist-ui.css` so it can be freely dragged across both the 3D `#visual-stage-canvas` AND down over the `#rolling-telemetry-deck` via mouse, touch-drag, or holding `[F]`.
  - Added diegetic corruption decryption: dragging the loupe over corrupted squirming telemetry text (`<span class="corrupt-cipher">`) reveals the hidden English translation inside the loupe's inspection readout.
- **Module 02 & 02.1 Input / Mobility Hooks:**
  - Added `window.VERMIS.inputMap` (Input Abstraction Layer) with an interactive MS-DOS key-remapper modal (`#remap-modal`) and `window.VERMIS.hotkeys` (`[Q]` and `[E]` modular hotkey slots) into the global namespace and DOM (`#modular-hotkey-bar`).
  - Added collapsible 8-way grid-snapping Mobile Touch Deck DOM containers (`#mobile-touch-deck`) and external script hooks (`js/controls.js`, `js/ui-dragger.js`) to align Module 01 with the Module 02 Blueprint.

---

### [v1.0] - 2026-10-18: Initial Module 01 Shell Architecture
#### Summary of Changes
- **Modular Directory Architecture:** Structured the project root `vermis-engine/` with dedicated subdirectories for `css/`, `js/core/`, `js/engine/`, `js/bestiary/`, and `js/rpg/`.
- **DOM & Viewport (`index.html`):**
  - Integrated the 320x400 lithography canvas (`#visual-stage-canvas`), offscreen G-Buffer debugging canvas (`#gbuffer-debug-canvas`), and circular magnifying loupe inset (`#loupe-canvas`).
  - Added a pinned cognitive HUD sidebar tracking class distinction, attributes, and all 9 canonical *Vermis I* states of flesh and mind.
  - Implemented the rolling terminal telemetry deck and choice directive buttons linked to keyboard inputs `[1]` through `[4]`.
  - Configured global namespace initialization (`window.VERMIS`) and fallback error handlers for offline `file://` execution.
- **Neo-Brutalist Layout (`css/brutalist-ui.css`):**
  - Established hard 2px–4px solid borders, zero rounded structural corners, and high-contrast terminal typography.
  - Implemented `.mech-term` mechanical term underlines for instant visual scanning of hazards, threats, and afflictions.
- **GPU CRT & Lithography Shaders (`css/crt-shaders.css`):**
  - Created SVG turbulence and displacement filters (`#vermis-litho-Warp`) for procedural paper grain roughness.
  - Added full-screen CRT scanline gratings, subpixel RGB phosphor separation, radial vignette shadows, and nerve spasm jitter keyframes.

### Vermis Engine - Module 02 Changelog (Shader Core, Input Abstraction & Tactile Loupe)
**Last Updated:** October 18, 2026
**Module:** Module 02 (`js/core/lithography.js`, `js/controls.js`, `js/ui-dragger.js`)
**Author:** Engineering / Architecture Log

---

#### Revision History
##### [v1.2] - 2026-10-18: Lithography Shader Core, 8-Way Input Abstraction & Diegetic Loupe Implementation
###### Summary of Changes
* **Lithography Shader Core (`js/core/lithography.js`):**
  * Implemented `window.VERMIS.LithographyShader` with precomputed 8x8 Ordered Bayer matrix (`BAYER_8X8`), 3-octave Fractional Brownian Motion (`fbm`) paper-stipple grain, and 32-bit ABGR `Uint32Array` spot-color palettes (`catacombs`, `flutewoods`, `brutalist`, `graveyard`, `swamp`).
  * Added **Rot Tier 1–4 Degradation** scaling (`setRotTier()`), increasing dither grain decay, proximity fog attenuation, and returning the flat +2 Target Number (TN) penalty at Rot Tier 4.
  * Added **Spectral Loupe Pass (`renderLoupePass`)**: Magnifies the `320x400` stage by 1.5x inside `#loupe-canvas` and reveals invisible Spectral Entities encoded at Material ID `G >= 240`.
* **Input Abstraction, 8-Way Mobility & Modular Hotkeys (`js/controls.js`):**
  * Built `window.VERMIS.inputMap` decoupling physical hardware events from 14 canonical engine actions (`ACTION_MOVE_FORWARD`, `ACTION_ATTACK`, `ACTION_LOUPE`, etc.) with an MS-DOS Terminal Remapper (`promptRemap()`).
  * Implemented `snapTo8WayGrid()` across Keyboard WASD, Mobile Touch Deck virtual joysticks, and HTML5 Gamepad Left Analog Sticks to enforce heavy 1990s grid-crawler movement friction.
  * Added `Daggerfall`-style directional mouse-drag/touch-swipe slash vector detection and `[Q]`/`[E]` modular hotkey hooks (`window.VERMIS.hotkeys`).
* **Tactile Draggable Loupe & Corrupt Cipher Decrypter (`js/ui-dragger.js`):**
  * Enabled free mouse-drag, touch-drag, `[F]`-key tracking, and Gamepad `LT` + Right Stick translation of `#loupe-inset` across both `#visual-stage-canvas` and `#rolling-telemetry-deck`.
  * Added real-time `.corrupt-cipher` bounding-box inspection that halts squirming corrupted glyphs and translates hidden lore into readable English inside the loupe badge.
