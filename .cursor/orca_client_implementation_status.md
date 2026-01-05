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
- [ ] `isMarker()` - Check if position is marker → **NOT IMPLEMENTED**
- [ ] `isNear()` - Check if position is near cursor → **NOT IMPLEMENTED**
- [ ] `isLocals()` - Check if position is local marker → **NOT IMPLEMENTED**
- [ ] `isInvisible()` - Check if cell should be invisible → **PARTIALLY IMPLEMENTED**
- [x] `findPorts()` - Find all operator ports → **IMPLEMENTED**

### ✅ Rendering Methods

- [x] `clear()` - Clear canvas → Implemented in `render()`
- [x] `drawProgram()` - Draw the grid → Implemented in `render()`
- [x] `makeStyle()` - Determine cell style → Implemented as `makeTheme()`
- [x] `drawSprite()` - Draw a single cell → **IMPLEMENTED**
- [ ] `drawInterface()` - Draw status bar → **NOT IMPLEMENTED**
- [ ] `drawGuide()` - Draw operator guide → **NOT IMPLEMENTED**
- [ ] `write()` - Write text to canvas → **NOT IMPLEMENTED**
- [x] `resize()` - Resize canvas → **IMPLEMENTED**

### ✅ Theme/Styling

- [x] `makeTheme()` - Get theme colors for cell type → **IMPLEMENTED**

### ❌ Documentation

- [ ] `docs()` - Show documentation → **NOT IMPLEMENTED** (not needed in Patchies)

## Missing Features Analysis

### Critical Missing Features (Breaking Basic Functionality)

1. **Selection reading** - The original uses `this.cursor.read()` to get current selection for highlighting
2. **Marker display** - Grid markers at intervals (+ symbols)
3. **Proper invisibility check** - Some cells should not render even with ports

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
2. ❌ Fix operator execution - Random operator not working
3. ❌ Add selection/highlighting support

### P1 - Core Features

1. ❌ Add grid markers
2. ❌ Improve invisibility logic
3. ❌ Add status interface bar

### P2 - Polish

1. ❌ Add guide display
2. ❌ Add grid resize controls
3. ❌ Add zoom controls

## Refactoring Needed

The `OrcaNode.svelte` file is growing large (496 lines). Recommended split:

1. **OrcaRenderer.ts** - All rendering logic (drawSprite, makeTheme, findPorts, etc.)
2. **OrcaNode.svelte** - Just UI markup and Svelte-specific logic
3. Keep Orca, Clock, and IO as separate modules (already done)
