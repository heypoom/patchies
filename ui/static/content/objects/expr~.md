Audio-rate mathematical expression evaluator for DSP.

Similar to `expr` but runs at audio rate for audio signal processing. Uses the
same [expr-eval](https://github.com/silentmatt/expr-eval) library.

## Usage

- Double click to edit the expression
- Use `Shift+Enter` to re-run
- Requires an audio source (use `sig~` for a constant signal)

> **Warning**: Use `compressor~` with limiter settings after `expr~` to avoid
> loud audio spikes that can damage your hearing and speakers!

## DSP Variables

- `s`: current sample value (-1 to 1)
- `i`: current sample index in buffer
- `t`: current time in seconds
- `channel`: current channel index (0 or 1 for stereo)
- `bufferSize`: audio buffer size (usually 128)
- `samples`: array of samples from current channel
- `input`: first input audio signal
- `inputs`: every connected input audio signal
- `$1` to `$9`: dynamic control inlets

## Examples

```js
// Sine wave oscillator at 440Hz
sin(t * 440 * PI * 2)

// White noise
random()

// Pass through input
s

// Gain control
s * $1

// Distortion
s ^ 2
```

## Dynamic Control Inlets

Create `$1` to `$9` variables for control inlets. Example: `$1 * 440` creates
one inlet controlling frequency. Connect a `slider 1 880` to control it.

## Example Patches

- [scales](/?id=tfjdf019hjyxmeu&readonly=true) by @kijjaz
  ([alt: sleep](/?id=xhdtrqenaf6ur81&readonly=true))
- [kicks](/?id=y1kbx9b2s903nlj&readonly=true) by @dtinth

## See Also

- [dsp~](/docs/objects/dsp~) - JavaScript DSP processor
- [expr](/docs/objects/expr) - control-rate expression evaluator
