# 148. Sonic MIDI Synth Presets

## Summary

Built-in `sonic~` synth presets should use the same MIDI `noteOn`/`noteOff`
boilerplate as SuperSonic SynthDef drops from the Samples sidebar.

## Requirements

- The default `sonic~` code uses the MIDI input synth template.
- `sonic-prophet` uses the SynthDef MIDI template for `sonic-pi-prophet`.
- `sonic-tb303` uses the SynthDef MIDI template for `sonic-pi-tb303`.
- Other built-in synth-style `sonic~` presets should reuse the same active-note
  management pattern when they trigger SynthDefs from incoming notes.
- Sample-player presets can keep bang/rate handling because they are not
  note-gated synth voices.

## Rationale

The Samples sidebar already creates playable SuperSonic SynthDef nodes that work
with MIDI-style message input and clean up active voices. Built-in presets should
match that behavior so the same upstream MIDI/keyboard objects work consistently
whether a node came from the preset browser or from dragging a SynthDef result.
