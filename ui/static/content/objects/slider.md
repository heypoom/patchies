Continuous value control with customizable range.

## Shorthand Commands

- `slider 100` - integer slider (0 to 100)
- `slider 20 880` - integer slider with min and max
- `slider 20 880 440` - with explicit default
- `fslider 1` - float slider (0 to 1)
- `fslider 2 5` - float slider (2 to 5)
- `vslider` / `vfslider` - vertical variants

## Settings

- **Mode** - Integer or Float precision
- **Minimum** - Lower bound of the range
- **Maximum** - Upper bound of the range
- **Default Value** - Initial value on reset
- **Orientation** - Vertical or Horizontal orientation
- **Resize** - Whether the slider is resizable
- **Lock**: Lock the slider to prevent moving and hide the inlet.

## See Also

- [knob](/docs/objects/knob) - circular encoder knob
- [toggle](/docs/objects/toggle) - boolean switch
- [textbox](/docs/objects/textbox) - text input
