Listen for keyboard input and output key events.

## Modes

- **Filtered** - Listen for a specific key. Outputs `bang` (or `true`/`false` in
up/down mode) when the bound key is pressed.

- **All Keys** - Listen for all keys. Outputs the key name as a string (or
`[key, state]` tuple in up/down mode).

## Trigger Types

- **Down** - Fire on key press
- **Up** - Fire on key release
- **Up/Down** - Fire on both press and release with state

## Output Examples

| Mode | Trigger | Output |
|------|---------|--------|
| Filtered | Down/Up | `bang` |
| Filtered | Up/Down | `true` or `false` |
| All Keys | Down/Up | `"A"`, `"SPACE"`, etc. |
| All Keys | Up/Down | `["A", true]` or `["A", false]` |

## Options

- **Allow repeated keys** - Enable to receive events while a key is held down

## See Also

- [button](/docs/objects/button) - manual trigger
- [midi.in](/docs/objects/midi.in) - MIDI controller input
