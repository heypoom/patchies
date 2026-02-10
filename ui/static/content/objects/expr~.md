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

## DSP Functions

- `phasor(freq, trigger?, resetPhase?)`: phase accumulator (0-1 ramp) at given
  frequency. Use for click-free oscillators with variable frequency.
  - `freq`: frequency in Hz
  - `trigger`: optional. Resets phase on positive zero-crossing (≤0 → >0)
  - `resetPhase`: optional. Phase value to reset to (default 0)

## Examples

```js
// Sine wave oscillator at 440Hz (fixed frequency)
sin(t * 440 * PI * 2)

// Variable frequency oscillator (use phasor for click-free modulation!)
sin(phasor($1) * PI * 2)

// White noise
random()

// Pass through input
s

// Gain control
s * $1

// Distortion
s ^ 2

// Hard sync: slave resets when master crosses zero
sin(phasor(880, phasor(110)) * PI * 2)

// Reset phasor via control inlet ($2 triggers on 0→1)
phasor($1, $2)
```

## Dynamic Control Inlets

Create `$1` to `$9` variables for control inlets. Example: `$1 * 440` creates
one inlet controlling frequency. Connect a `slider 1 880` to control it.

## phasor vs t

Use `t` for static expressions where frequency doesn't change:

```js
sin(t * 440 * PI * 2)  // Fixed 440Hz - OK with t
```

Use `phasor()` when frequency is controlled by an inlet:

```js
sin(phasor($1) * PI * 2)  // Variable freq - use phasor!
```

**Why does `sin(t * $1)` click?** When you change `$1` at time t=1.5s from 440 to
441, the phase jumps from `1.5 * 440 = 660` to `1.5 * 441 = 661.5` cycles - an
instant 1.5 cycle discontinuity that causes a loud click.

**How phasor fixes it:** Instead of computing phase from absolute time, `phasor`
accumulates phase incrementally (`phase += freq / sampleRate`). When frequency
changes, phase doesn't jump - it just starts incrementing faster or slower from
wherever it currently is.

## Phase Sync (Hard Sync)

The `phasor` function supports phase synchronization via an optional trigger
parameter. When the trigger signal crosses from ≤0 to >0, the phasor resets.

```js
// Hard sync: 880Hz slave synced to 110Hz master
sin(phasor(880, phasor(110)) * PI * 2)

// Reset phase via control inlet
phasor($1, $2)        // $2 going 0→1 resets phase

// Reset to specific phase (0.5 = middle of cycle)
phasor($1, $2, 0.5)
```

**Hard sync** creates the classic aggressive synth sound - the slave oscillator
restarts its cycle every time the master completes one. Lower master frequencies
create more harmonics.

## Presets

Enable the **DSP Presets** pack in Extensions to use these. Type in the object
browser to create pre-configured expr~ nodes:

- `sine-osc.dsp` - Fixed 440Hz sine wave oscillator
- `variable-osc.dsp` - Variable frequency sine oscillator (connect freq to $1)
- `phasor.dsp` - Sawtooth wave with variable frequency
- `bitcrusher.dsp` - Bit depth reduction effect (connect bit depth to $1)
- `hardsync.dsp` - Hard sync oscillator ($1=slave freq, $2=master freq)

## Example Patches

- [scales](/?id=tfjdf019hjyxmeu&readonly=true) by @kijjaz
  ([alt: sleep](/?id=xhdtrqenaf6ur81&readonly=true))
- [kicks](/?id=y1kbx9b2s903nlj&readonly=true) by @dtinth

## See Also

- [dsp~](/docs/objects/dsp~) - JavaScript DSP processor
- [expr](/docs/objects/expr) - control-rate expression evaluator
