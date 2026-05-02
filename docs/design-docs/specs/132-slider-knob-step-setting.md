# 132. Slider and Knob Step Setting

## Summary

`slider` and `knob` controls store an optional `step` value in node data. The default preserves existing behavior: integer controls move in whole-number steps, and float controls move in `0.01` steps. When present, `step` controls the HTML range input step for sliders and the quantization used by both sliders and knobs.

## Behavior

- `step` must be positive. Empty or invalid settings fall back to the mode default.
- User interaction snaps values to the nearest step from the current minimum.
- Incoming numeric messages and `setValue` messages are clamped to min/max and snapped to the configured step.
- Changing min/max keeps the current value in bounds and snapped.
- Changing `step` records undo/redo history like min/max/default changes.
- Shorthands accept an optional fourth numeric argument: `[min] <max> [default] [step]`.

## Examples

```text
slider 0 1 0.5 0.05
fslider 20 880 440 0.5
knob 0 127 64 1
fknob 0 1 0.25 0.001
```
