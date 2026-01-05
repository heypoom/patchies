# Orca Client.js Implementation Status

This document tracks which methods from the original `client.js` have been implemented in `OrcaNode.svelte`.

## Original client.js Methods

### ✅ Core Lifecycle Methods

- [x] `install()` - Setup and initialization → Implemented in `onMount()`
- [x] `start()` - Start the application → Implemented in `onMount()`
- [x] `reset()` - Reset grid → Partially implemented (can reset grid size)
- [x] `run()` - Run one frame of Orca → Implemented in `onTick()`
- [x] `update()` - Update and render → Implemented in `render()`

### ✅ File/Data Management

- [ ] `whenOpen()` - Load file data → **NOT IMPLEMENTED** (could load presets instead)
- [ ] `setGrid()` - Change grid dimensions → **NOT IMPLEMENTED**
- [ ] `crop()` - Crop grid to content → **NOT IMPLEMENTED**

### ⚠️ Display Settings

- [x] `toggleRetina()` - Toggle retina display → Not needed (using `window.devicePixelRatio`)
- [ ] `toggleGuide()` - Toggle guide display → **NOT IMPLEMENTED**
- [ ] `modGrid()` - Modify grid dimensions → **NOT IMPLEMENTED**
- [ ] `modZoom()` - Modify zoom level → **NOT IMPLEMENTED**

### ✅ Grid Helper Methods

- [x] `isCursor()` - Check if position is cursor → Implemented inline in `render()`
- [x] `isMarker()` - Check if position is marker → **IMPLEMENTED** (8x8 grid)
- [x] `isNear()` - Check if position is near cursor → **IMPLEMENTED**
- [x] `isLocals()` - Check if position is local marker → **IMPLEMENTED** (4x4 local grid)
- [x] `isInvisible()` - Check if cell should be invisible → **IMPLEMENTED**
- [x] `findPorts()` - Find all operator ports → **IMPLEMENTED**

### ✅ Rendering Methods

- [x] `clear()` - Clear canvas → Implemented in `render()`
- [x] `drawProgram()` - Draw the grid → Implemented in `render()`
- [x] `makeStyle()` - Determine cell style → Implemented as `makeTheme()`
- [x] `drawSprite()` - Draw a single cell → **IMPLEMENTED**
- [x] `drawInterface()` - Draw status bar → **IMPLEMENTED** (cursor info, position, frame, variables)
- [x] `drawGuide()` - Draw operator guide → **IMPLEMENTED** (toggleable overlay)
- [x] `write()` - Write text to canvas → **IMPLEMENTED** (helper function)
- [x] `resize()` - Resize canvas → **IMPLEMENTED**

### ✅ Theme/Styling

- [x] `makeTheme()` - Get theme colors for cell type → **IMPLEMENTED**

### ❌ Documentation

- [ ] `docs()` - Show documentation → **NOT IMPLEMENTED** (not needed in Patchies)

## Missing Features Analysis

### Critical Missing Features (Breaking Basic Functionality)

1. ~~**Selection reading**~~ - Not needed for basic functionality (would enable multi-cell selection highlighting)
2. ✅ **Marker display** - **IMPLEMENTED** - Grid markers (+) at 8x8 intervals, local markers (·) at 4x4 near cursor
3. ✅ **Proper invisibility check** - **IMPLEMENTED** - Correctly checks markers, locals, ports, locks

### Nice-to-Have Features

1. **Interface bar** - Status display showing cursor position, frame count, BPM
2. **Guide display** - Operator documentation overlay
3. **Grid resize** - Dynamic grid size adjustment

### Not Needed (Patchies-specific)

1. File open/save - Patchies handles this at patch level
2. Commander - Command palette (could add later)
3. Zoom controls - Patchies might handle this differently

## Priority Fixes

### P0 - Blocking Basic Usage

1. ✅ Port visualization - **DONE**
2. ✅ Fix operator execution - **DONE** (Fixed passive/active operator instantiation)
3. ✅ Grid markers and local markers - **DONE**

### P1 - Core Features

1. ✅ Add grid markers - **DONE**
2. ✅ Improve invisibility logic - **DONE**
3. ✅ Add status interface bar - **DONE**

### P2 - Polish

1. ✅ Add guide display - **DONE**
2. ✅ Add grid resize controls - **DONE** (in settings panel)
3. ❌ Add zoom controls

## Refactoring Needed

The `OrcaNode.svelte` file is growing large (496 lines). Recommended split:

1. **OrcaRenderer.ts** - All rendering logic (drawSprite, makeTheme, findPorts, etc.)
2. **OrcaNode.svelte** - Just UI markup and Svelte-specific logic
3. Keep Orca, Clock, and IO as separate modules (already done)
