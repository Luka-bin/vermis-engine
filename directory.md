vermis-engine/
├── index.html                  # Module 01: DOM Shell, Togglable .dos-modal layout, VERMIS.UI delegation
├── css/
│   ├── brutalist-ui.css        # Module 01: 3-zone layout, full-width viewport, [hidden] overrides
│   └── crt-shaders.css         # Module 01: GPU SVG/CRT shaders, phase-bleed hidden guards
└── js/
    ├── core/
    │   ├── settings.js         # Module 00: Difficulty Scaling, Preferences Walkthrough, Gyro Lock
    │   ├── state.js            # Module 00 & 03.2: Boot pipeline, Master Clock, Re-entrancy locks
    │   └── lithography.js      # Module 02: Shared G-Buffer, 8x8 Bayer Shader, Spectral Loupe
    ├── engine/
    │   ├── raycaster.js        # Module 02 & 03.2: Labyrinth Generation, Z-Buffer, tile.consumed locks
    │   └── billboard.js        # Module 03: Z-clipped sprites, 4-stage Enemy AI telegraphs
    ├── ui/
    │   ├── ui-dragger.js       # Module 02.1 & 03.1: Pointer Events API, Paper-Doll spatial math
    │   └── controls.js         # Module 02.1 & 03.1: 8-way grid snapping, Diegetic Loupe decryption
    ├── rpg/
    │   ├── character.js        # Module 00, 03 & 03.2: 20-Point Vessel Builder, 6-stage Dirty-Flag
    │   └── combat.js           # Module 03 & 03.2: RTwP action-recovery, Auto-Pause interrupts
    └── bestiary/
        ├── stench_champion.js  # Module 04: Procedural rigs and G-Buffer draw calls
        ├── light_gobbler.js    # Module 04: Procedural rigs and G-Buffer draw calls
        └── marionette.js       # Module 04: Procedural rigs and G-Buffer draw calls
