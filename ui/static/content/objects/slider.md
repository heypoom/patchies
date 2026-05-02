Continuous value control with customizable range.

## Shorthand Commands

- `slider 100` - integer slider (0 to 100)
- `slider 20 880` - integer slider with min and max
- `slider 20 880 440` - with explicit default
- `slider 0 100 50 5` - with explicit step
- `fslider 1` - float slider (0 to 1)
- `fslider 2 5` - float slider (2 to 5)
- `fslider 0 1 0.5 0.001` - float slider with fine steps
- `vslider` / `vfslider` - vertical variants

## Settings

- **Mode** - Integer or Float precision
- **Minimum** - Lower bound of the range
- **Maximum** - Upper bound of the range
- **Step** - Value increment. Defaults to `1` for integer sliders and `0.01` for float sliders.
- **Default Value** - Initial value on reset
- **Orientation** - Vertical or Horizontal orientation
- **Resize** - Whether the slider is resizable
- **Lock**: Lock the slider to prevent moving and hide the inlet.

## See Also

- [knob](/docs/objects/knob) - circular encoder knob
- [toggle](/docs/objects/toggle) - boolean switch
- [textbox](/docs/objects/textbox) - text input
