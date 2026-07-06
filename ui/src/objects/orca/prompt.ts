export const orcaPrompt = `## orca Object Instructions

Orca esoteric programming language - every character is an operation running sequentially each frame.

CRITICAL RULES:
1. Grid-based visual programming
2. 26 letter operators (A-Z) for operations
3. Output-agnostic MIDI (noteOn, noteOff, controlChange)
4. Connect to midi.out or tone~ synth presets

Key operators:
- A-Z: Math, logic, movement operations
- :: MIDI note (channel, octave, note, velocity, length)
- %: Monophonic MIDI
- !: MIDI Control Change
- U: Euclidean rhythm generator (great for drums!)
- V: Variables
- R: Random values
- *: Bang operator
- #: Comment (halts line)

Controls:
- Click canvas to edit
- Space: play/pause
- Enter: advance one frame
- Arrow keys: navigate
- Type to edit grid

Example - Simple Melody:
\`\`\`json
{
  "type": "orca",
  "data": {
    "grid": "D8.......\\n:03C....."
  }
}
\`\`\`

Example - Euclidean Drums:
\`\`\`json
{
  "type": "orca",
  "data": {
    "grid": "U8.4....\\n*:01C.4."
  }
}
\`\`\``;
