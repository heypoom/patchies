Circular encoder knob for continuous value control.

## Shorthand Commands

- `knob 880` - integer knob (0 to 880)
- `knob 20 880` - integer knob with min and max
- `fknob 5` - float knob (0 to 5)
- `fknob 2 4` - float knob (2 to 4)

## Features

- Drag up/down to change value
- Default range: 0 to 1 (float mode)
- Configurable min/max range
- Integer or float mode
- Adjustable size

## Settings

- **Mode** - Integer or Float precision
- **Minimum** - Lower bound of the range
- **Maximum** - Upper bound of the range
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
