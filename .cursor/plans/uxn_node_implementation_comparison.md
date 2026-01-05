# Uxn Node Implementation: Plan vs uxn5 Reference Comparison

## Overview

This document compares the planned implementation with the actual uxn5 reference implementation in `.references/uxn5/src/`.

## Key Architectural Differences

### 1. Emulator Structure

**Plan:**

- `UxnEmulator` class with `Map<number, UxnDevice>` for device routing
- Devices implement `UxnDevice` interface with optional `init()`, `dei()`, `deo()`, `destroy()`

**uxn5 Reference:**

- `Emu` function constructor (not a class)
- Devices are direct properties: `this.system`, `this.console`, `this.controller`, etc.
- Devices are function constructors, not classes
- Device routing via `switch` statements in `dei()` and `deo()` methods

**Recommendation:** Keep the plan's class-based approach for TypeScript, but simplify device routing to match uxn5's pattern.

### 2. Device Interface

**Plan:**

```typescript
interface UxnDevice {
  init?(): void;
  dei?(port: number): number;
  deo?(port: number, value: number): void;
  destroy?(): void;
}
```

**uxn5 Reference:**

- Devices are function constructors that take `emu` as parameter
- No formal interface - devices have methods as needed
- `init()` is called explicitly, not via interface
- `dei()` and `deo()` are called directly from emulator's routing

**Recommendation:** Simplify interface - devices just need `dei()` and `deo()`, and optionally `init()`. No need for `destroy()` initially.

### 3. Device Port Routing

**Plan:**

- Uses `Map<number, UxnDevice>` for routing
- Each device handles a port range

**uxn5 Reference:**

- `dei()` uses `switch (port & 0xf0)` to route by port range:
  - `0xc0`: DateTime
  - `0x20`: Screen
  - Default: `this.uxn.dev[port]`
- `deo()` uses `switch(port & 0xf0)` to route:
  - `0x00`: System
  - `0x10`: Console
  - `0x20`: Screen
  - Default: `this.uxn.dev[port] = val`

**Recommendation:** Use switch-based routing like uxn5 - simpler and more explicit.

### 4. uxn.wasm Integration

**Plan:**

- Assumes `uxn.wasm` package provides `Uxn` class
- Async `init()` method

**uxn5 Reference:**

- Checks for `UxnWASM` global (from `uxn-wasm.js`)
- Falls back to vanilla JS `Uxn` if not available
- `uxn.wasm` provides `UxnWASM.Uxn` class
- `init()` is async and returns a promise
- WASM version uses `WebAssembly.instantiate()` with device callbacks

**Recommendation:** Match uxn5's pattern - check for WASM, fallback to JS. The `uxn.wasm` package should provide the WASM version.

### 5. Screen Device Details

**Plan:**

- Mentions ports 0x20-0x2f: pixels, sprites, palette

**uxn5 Reference:**

- Complex rendering with:
  - Two layers: `fg` (foreground) and `bg` (background)
  - Palette system with 4 colors
  - Sprite rendering with blending modes
  - Dirty rectangle tracking (`x1, y1, x2, y2`)
  - `repaint` flag for full redraws
  - `vector` callback for screen updates
  - `MAR()` and `MAR2()` helper functions for memory addressing
  - Scale/zoom support

**Key Ports:**

- `0x20-0x21`: Vector (callback address)
- `0x22-0x23`: Width
- `0x24-0x25`: Height
- `0x26`: Mode/control
- `0x28-0x29`: X position
- `0x2a-0x2b`: Y position
- `0x2c-0x2d`: Address
- `0x2e`: Pixel/fill control
- `0x2f`: Sprite control

**Recommendation:** Screen device is complex - port it carefully, maintaining all rendering logic.

### 6. Console Device

**Plan:**

- Ports 0x10-0x1f: stdin, stdout, stderr

**uxn5 Reference:**

- `0x10-0x11`: Vector (callback address)
- `0x12`: Input character
- `0x17`: Input type (0=stdin, 1=keyboard)
- `0x18`: Write (stdout)
- `0x19`: Error (stderr)
- `0x1a-0x1b`: Debug output
- Uses DOM elements for I/O
- `on_console` handler for Enter key

**Recommendation:** For Patchies, route console output to EventBus instead of DOM elements.

### 7. Controller Device

**Plan:**

- Ports 0x80-0x8f: keyboard

**uxn5 Reference:**

- `0x80-0x81`: Vector (callback address)
- `0x82`: Button state (8 bits: Ctrl, Alt, Shift, Esc, Up, Down, Left, Right)
- `0x83`: Key code
- Two modes: `keyctrl` (gamepad-like) vs normal (keyboard)
- Handles paste events
- Prevents default on certain keys

**Recommendation:** Match uxn5's button mapping. For Patchies, we may want to capture keyboard events at the node level.

### 8. Mouse Device

**Plan:**

- Ports 0x90-0x9f: position, buttons, scroll

**uxn5 Reference:**

- `0x90-0x91`: Vector (callback address)
- `0x92-0x93`: X position (16-bit)
- `0x94-0x95`: Y position (16-bit)
- `0x96`: Button state (1=left, 2=right, 4=middle)
- `0x9c-0x9d`: Scroll delta (16-bit, signed)
- Button mapping: `0x1` → left, `0x2` → right, `0x4` → middle
- Coordinates relative to canvas bounds

**Recommendation:** Mouse coordinates should be relative to the canvas element in the node.

### 9. DateTime Device

**Plan:**

- Ports 0xc0-0xcf: year, month, day, hours, minutes, seconds

**uxn5 Reference:**

- `0xc0-0xc1`: Year (16-bit)
- `0xc2`: Month (0-11)
- `0xc3`: Day (1-31)
- `0xc4`: Hours (0-23)
- `0xc5`: Minutes (0-59)
- `0xc6`: Seconds (0-59)
- `0xc7`: Day of week (0-6)
- `0xc8-0xc9`: Day of year (16-bit)
- Read-only (only `dei`, no `deo`)

**Recommendation:** This is the simplest device - good starting point.

### 10. System Device

**Plan:**

- Ports 0x00-0x0f: palette, expansion, halt

**uxn5 Reference:**

- `0x02-0x03`: Expansion operation (fill, cpyl, cpyr)
- `0x06-0x07`: Metadata address
- `0x08-0x0d`: Palette colors (RGB, 3x16-bit)
- `0x0f`: Halt (program end)
- `expansion()` handles memory operations across pages
- `metadata()` displays ROM metadata in DOM

**Recommendation:** For Patchies, metadata could be logged or displayed in node UI.

### 11. Initialization and Boot

**Plan:**

- `async init()` method
- `loadCode()` and `loadROM()` methods

**uxn5 Reference:**

- `init(embed)` sets up DOM, drag/drop, URL hash ROM loading
- `start(rom)` loads ROM and calls `eval(0x0100)`
- `load(rom)` is alias for `start(rom)`
- Boot ROM can be embedded or loaded from URL
- 60fps render loop: `setInterval(() => requestAnimationFrame(...), 1000/60)`
- Render loop calls `screen.vector` if set, handles repaints

**Recommendation:** For Patchies:

- No DOM setup needed (handled by Svelte)
- No drag/drop (handled by node system)
- Render loop should be tied to canvas rendering
- ROM loading from node data or code input

### 12. Memory and Device Access

**Plan:**

- Assumes `uxn.wasm` provides memory access

**uxn5 Reference:**

- `uxn.ram`: Uint8Array of memory (64KB)
- `uxn.dev`: Uint8Array of device ports (256 bytes)
- `uxn.wst`: Working stack
- `uxn.rst`: Return stack
- WASM version exposes `ram`, `dev`, `wst`, `rst` via WebAssembly memory
- Helper functions: `peek16()`, `poke16()` for 16-bit access

**Recommendation:** Use helper functions for 16-bit port access.

### 13. Render Loop

**Plan:**

- Not explicitly mentioned

**uxn5 Reference:**

- 60fps loop that:
  1. Calls `screen.vector` if set (via `uxn.eval()`)
  2. Handles `screen.repaint` flag (full redraw)
  3. Handles dirty rectangles via `screen.changed()`
  4. Updates canvas via `putImageData()`

**Recommendation:** For Patchies, integrate with existing canvas rendering system. May need to throttle or use requestAnimationFrame.

## Missing from Plan

1. **Helper Functions**: `peek16()`, `poke16()` for 16-bit memory access
2. **Render Loop**: Need explicit render loop for screen updates
3. **Vector Callbacks**: Devices use vector addresses for callbacks
4. **Stack Access**: `wst` and `rst` stacks may be needed for debugging
5. **ULZ Compression**: uxn5 supports compressed ROMs (not critical for initial implementation)

## Recommendations

### Phase 1 Adjustments

1. **Device Interface**: Simplify to just `dei()` and `deo()` methods
2. **Routing**: Use switch-based routing like uxn5 (simpler than Map)
3. **Helper Functions**: Add `peek16()` and `poke16()` utilities

### Phase 2 Adjustments

1. **Start with DateTime**: Simplest device (read-only, no callbacks)
2. **Then System**: Simple write-only operations
3. **Then Console**: Output to EventBus instead of DOM
4. **Screen is Complex**: Save for later, needs full rendering pipeline
5. **Controller/Mouse**: Need event handling integration

### Phase 3 Adjustments

1. **Emulator Class**: Keep class-based, but match uxn5's device structure
2. **WASM Integration**: Check for WASM, fallback to JS (if available)
3. **Memory Access**: Expose `ram`, `dev`, `wst`, `rst` properties

### Phase 4 Adjustments

1. **Canvas Integration**: Use existing canvas system
2. **Render Loop**: Integrate with node's update cycle
3. **Event Handling**: Keyboard/mouse events at node level

## Port Map Summary (from uxn5)

```
0x00-0x0f: System (palette, expansion, halt)
0x10-0x1f: Console (vector, input, output, error)
0x20-0x2f: Screen (vector, size, position, drawing)
0x80-0x8f: Controller (vector, buttons, keycode)
0x90-0x9f: Mouse (vector, position, buttons, scroll)
0xc0-0xcf: DateTime (read-only time values)
0xd0-0xdf: Patchies (custom - message passing)
```

## Next Steps

1. Update plan with switch-based routing
2. Add helper functions (`peek16`, `poke16`)
3. Clarify render loop integration
4. Simplify device interface
5. Document vector callback system
6. Plan screen device complexity (may need separate phase)
