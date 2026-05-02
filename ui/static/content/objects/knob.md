Circular encoder knob for continuous value control.

## Shorthand Commands

- `knob 880` - integer knob (0 to 880)
- `knob 20 880` - integer knob with min and max
- `knob 0 127 64 1` - integer knob with explicit default and step
- `fknob 5` - float knob (0 to 5)
- `fknob 2 4` - float knob (2 to 4)
- `fknob 0 1 0.25 0.001` - float knob with fine steps

## Features

- Drag up/down to change value
- Default range: 0 to 1 (float mode)
- Configurable min/max range
- Configurable step size
- Integer or float mode
- Adjustable size

## Settings

- **Mode** - Integer or Float precision
- **Minimum** - Lower bound of the range
- **Maximum** - Upper bound of the range
- **Step** - Value increment. Defaults to `1` for integer knobs and `0.01` for float knobs.
- **Default Value** - Initial value on reset
- **Size** - Knob diameter in pixels
- **Ports** - Inlet/outlet visibility with three states:
  - Auto (dash) - Hide when not connected, show when connected
  - Show (checkmark) - Always visible
  - Hide (X) - Always hidden

## See Also

- [slider](/docs/objects/slider) - linear slider control
- [toggle](/docs/objects/toggle) - boolean switch
- [textbox](/docs/objects/textbox) - text input
