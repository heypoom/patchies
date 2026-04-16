# 133. Anupars Object

A terminal-based musical sequencer driven by regular expressions (RegExp), integrated as a Patchies node via WASM.

## Overview

Anupars is a roguelike terminal-based musical sequencer that uses regex patterns to trigger MIDI notes on a 2D text grid. The WASM build renders ANSI escape sequences to an xterm.js terminal embedded in a Patchies node.

## Architecture

- **WASM core**: Pre-built Rust binary handles all sequencer logic, timing, regex matching, and MIDI generation
- **xterm.js**: Renders ANSI output from WASM; forwards keyboard/mouse input back to WASM
- **Message system**: Raw 3-byte MIDI messages from WASM are converted to Patchies noteOn/noteOff/controlChange messages

## WASM API

```typescript
wasm_init(cols, rows)           // Initialize with terminal dimensions
wasm_step(elapsed_ms)           // Advance one frame (~60fps)
wasm_render() → string          // Get ANSI output
wasm_send_key(key)              // Forward keyboard input
wasm_send_mouse(kind, btn, col, row)  // Forward mouse events
wasm_resize(cols, rows)         // Handle resize
wasm_take_midi_message() → Uint8Array | undefined  // Pop 3-byte MIDI
```

## MIDI Output Mapping

Raw MIDI bytes → Patchies messages:
- `0x90` (Note On): `{ type: 'noteOn', note, velocity, channel }`
- `0x80` (Note Off): `{ type: 'noteOff', note, channel }`
- `0xB0` (CC): `{ type: 'controlChange', control, value, channel }`

## UI

Similar to Orca node:
- Draggable title header
- xterm.js terminal canvas (nodrag area)
- Message inlet for control (play/stop/bang)
- Message outlet for MIDI output
- Freeze button (pauses the worker step/render loop to free the CPU when idle)
- Settings panel for terminal dimensions and font size

## Key Controls (handled by WASM)

- `Space` - Play/pause
- `h/j/k/l` - Move playhead
- `Esc` - Toggle regex/grid mode
- `>/<` - BPM up/down
- Number keys - Grid splits
- `Ctrl+letter` - Mode toggles (arpeggiator, sweep, drone, etc.)

## Files

- `ui/src/objects/anupars/` - Module root
  - `wasm/` - WASM artifacts (anupars.js, anupars_bg.wasm, type defs)
  - `components/AnuparsNode.svelte` - Main node component
  - `schema.ts` - Object schema with inlet/outlet definitions
  - `prompts.ts` - AI prompt for object generation
