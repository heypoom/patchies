Filter expression evaluator for building FIR and IIR filters.

Similar to `expr~` but processes sample-by-sample with access to previous input
and output samples. This enables feedback loops for IIR filters and delay-based
effects.

## Usage

- Double click to edit the expression
- Use `Shift+Enter` to re-run
- Requires an audio source (use `sig~` for a constant signal)

> **Warning**: IIR filters with feedback (`y1[-1]`) can become unstable and
> produce extremely loud output! Always use `compressor~` with limiter settings
> after `fexpr~`.

## Variables

### Signal Inputs with History

- `x1`, `x2`, ... `x9` (or `s1`, `s2`, ... `s9`): current sample from each input
- `x1[-1]`, `x1[-2]`, etc.: previous input samples (up to 128 samples back)
- Fractional indices like `x1[-1.5]` use linear interpolation

### Output History (Feedback)

- `y1[-1]`, `y1[-2]`, etc.: previous output samples (for IIR filters)
- Only negative indices allowed (can't look into the future!)

### Control Values

- `$1` to `$9`: control inlet values (same as expr~)

### Other Variables

- `i`: current sample index in buffer
- `t`: current time in seconds

## FIR Filter Examples

FIR (Finite Impulse Response) filters only use input history - no feedback.

```js
// Simple averaging filter (2-tap)
(x1 + x1[-1]) / 2

// 4-sample moving average (smoothing)
(x1 + x1[-1] + x1[-2] + x1[-3]) / 4

// Simple differentiator (high-pass character)
x1 - x1[-1]

// 3-tap FIR lowpass
x1 * 0.25 + x1[-1] * 0.5 + x1[-2] * 0.25
```

## IIR Filter Examples

IIR (Infinite Impulse Response) filters use output feedback via `y1[-n]`.

```js
// One-pole lowpass (smoothing)
// Higher coefficient = more smoothing
x1 * 0.1 + y1[-1] * 0.9

// One-pole highpass
x1 - x1[-1] + y1[-1] * 0.95

// DC blocker
x1 - x1[-1] + y1[-1] * 0.995

// Resonant filter (be careful - can self-oscillate!)
x1 + y1[-1] * 1.8 - y1[-2] * 0.85
```

## Delay Effects

```js
// Simple delay (32 samples)
x1 + x1[-32] * 0.5

// Comb filter with feedback
x1 + y1[-32] * 0.7

// Allpass filter
x1[-20] + y1[-20] * 0.7 - x1 * 0.7
```

## Control Integration

```js
// Lowpass with variable smoothing ($1 = 0 to 0.99)
x1 * (1 - $1) + y1[-1] * $1

// Variable delay amount
x1 + x1[-32] * $1

// Variable feedback
x1 + y1[-32] * $1
```

## Multiple Outlets

Each non-assignment expression creates its own audio outlet
with independent output history. Separate expressions with
semicolons or newlines:

```js
// 2 outlets: lowpass and highpass from same input
x1 * 0.1 + y1[-1] * 0.9
x1 - x1[-1] + y2[-1] * 0.95
```

Each outlet has its own `y` history: `y1[-1]` is outlet 1's
previous output, `y2[-1]` is outlet 2's, etc. All `y`
accessors are available to all expressions,
enabling cross-outlet feedback.

## Stability Warning

IIR filters can become unstable if feedback coefficients are too high:

- Keep feedback multipliers below 1.0 (e.g., `y1[-1] * 0.9`)
- Test with quiet input first
- Always use a limiter after `fexpr~`

## Differences from expr~

| Feature | expr~ | fexpr~ |
|---------|-------|--------|
| Processing | Block-based | Sample-by-sample |
| Input history | No | Yes (`x1[-n]`) |
| Output feedback | No | Yes (`y1[-n]`) |
| Use case | General DSP | Filters, delays |
| Performance | Faster | Slower (per-sample) |

## See Also

- [expr~](/docs/objects/expr~) - block-based expression evaluator
- [comb~](/docs/objects/comb~) - dedicated comb filter
- [lowpass~](/docs/objects/lowpass~) - biquad lowpass filter
