# ABYSSAL LITHOGRAPHY ENGINE // vermis-engine

A modular, lightweight 2.5D survival-horror engine built with standard web technologies (HTML5, CSS3, and vanilla JavaScript). Designed around a grim, dark-fantasy aesthetic with a retro CRT/brutalist interface, seed-locked PRNG dungeon generation, and real-time with pause (RTwP) combat mechanics.

> **Disclaimer & Attribution:** This project is a non-commercial, fan-made tribute built out of deep admiration for the dark fantasy universe and art style of ***Vermis***, originally created by Plastiboo. All underlying aesthetic and world-building concepts belong to their respective creators. This code repository is intended purely as a technical homage and portfolio piece.

---

## 📂 Architectural Directory Structure

To ensure clean isolation and avoid mobile editor sandboxing issues, the engine is decoupled into modular directories governed by a global `window.VERMIS` namespace:

```text
vermis-engine/
├── index.html                        # [Module 01] Core DOM shell, viewport canvas, & script loader
├── css/
│   ├── brutalist-ui.css              # [Module 01] Neo-Brutalist layout, high-contrast borders, & HUD
│   └── crt-shaders.css               # [Module 01] GPU scanlines, phosphor bleed, & SVG paper-grain filters
└── js/
    ├── core/
    │   ├── state.js                  # [Module 00] Global state machine, PRNG seed-locking, & game clock
    │   ├── settings.js               # [Module 00] Difficulty scaling & preferences configuration
    │   └── lithography.js            # [Module 02] 8x8 Bayer dither shaders & G-Buffer spectral filters
    ├── engine/
    │   ├── raycaster.js              # [Module 02] 2.5D DDA raycaster, walker labyrinth, & Rot Tiers
    │   ├── controls.js               # [Module 02] Input abstraction layer & 8-way movement snapping
    │   └── billboard.js              # [Module 03] Z-clipped 3D sprites & 4-stage enemy telegraph AI
    ├── rpg/
    │   ├── character.js              # [Module 03] 20-Point Vessel Builder, traits, & dirty-flag pipeline
    │   └── combat.js                 # [Module 03] RTwP recovery timers, Auto-Pause interrupts, & re-entrancy locks
    └── ui/
        └── ui-dragger.js             # [Module 02.1] Unified pointer events API & AABB paper-doll inventory grid
