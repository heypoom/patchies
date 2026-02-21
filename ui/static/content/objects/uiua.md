Executes [Uiua](https://www.uiua.org/) code, a stack-based array programming language.

Tip: Write your Uiua code in [Array Box](https://arraybox.dev) or the
[Uiua Website](https://www.uiua.org) for a nicer editing experience.

## Outputs

Uiua can output multiple data types:

- **Message outlet**: Text, arrays, and audio samples (Float32Array)
- **Video outlet**: Images and GIFs (enable in settings)

### Audio Samples

Uiua can generate audio as WAV data. When output through the message outlet,
audio is automatically decoded to `Float32Array` which can be connected
directly to:

- [sampler~](/docs/objects/sampler~) - Load samples for playback
- [table](/docs/objects/table) - Store in a named buffer for use with [tabread~](/docs/objects/tabread~)

### Images and GIFs

Enable the video outlet in settings to send images and GIFs through the
video pipeline. Static images and animated GIFs are both supported.

## Preview and Settings

Click the **⋮** menu (top-right when selected) to access:

- **Preview**: View output images, GIFs, SVGs, and play audio
- **Settings**: Toggle message/video outlets

## Hot/Cold Placeholders

Use `$1`, `$2`, etc. as placeholders for inlet values
that get substituted before evaluation.

- **$1 (hot)**: First inlet triggers evaluation when it receives a value
- **$2, $3, ...** (cold): Store values but don't trigger evaluation

## Examples

### Basic arithmetic

```txt
+ $1 $2
```

Connect two number sources. When `$1` receives a value,
the sum is computed and output.

### Array operations

```txt
/+ $1
```

Sum all elements in an array received at `$1`.

### Sine wave audio

```txt
[0 4 7 10]     # Notes
×220 ˜ⁿ2÷12    # Freqs
∿×τ ⊞× ÷⟜⇡&asr # Generate
÷⧻⟜/+⍉         # Mix
```

Generates a chord from MIDI note offsets. Connect output to `sampler~` or `table`.

### Uiua Logo (image)

```txt
U ← /=⊞<0.2_0.7 /+×⟜ⁿ1_2
I ← <⊙(⌵/ℂ)
u ← +0.1⧋↧ ⊃(I0.95|⊂⊙0.5⇌˙×)
A ← ×⊃U(I1)
⧋(⊂⊃u A) ˙⊞⊟-⊸¬÷⟜⇡200
```

Generates the Uiua logo as an image. Enable video outlet to view.

### Mandelbrot fractal

```txt
×2 ⊞ℂ⤙-1/4 -1/2÷⟜⇡300
>2⌵ ⍥⟜⊸(+⊙°√) 50 ⟜∘
÷⧻⟜/+
```

### Conway's Game of Life

```txt
Life ← ↥∩=₃⟜+⊸(/+↻⊂A₂C₂)
⁅×0.6 gen⊙⚂ ˙⊟30
⍥⊸Life100
≡▽₂ 4
```

## Uiua Syntax

Uiua uses Unicode glyphs for operations:

- `+` `-` `×` `÷` - arithmetic
- `⇡` - range (iota)
- `⇌` - reverse
- `/` - reduce
- `\` - scan
- `≡` - rows (map)
- `⊂` - join
- `⊏` - select

Negative numbers use `¯` (not `-`): `¯5` means -5.

## Glyph Documentation

Hover over any Uiua glyph in the code editor to see inline documentation
showing the glyph's name, type, signature, and description.

## Auto-formatting

Press Shift+Enter to format your code using Uiua's built-in formatter.

## See also

- [Uiua documentation](https://www.uiua.org/docs)
- [Uiua tutorial](https://www.uiua.org/tutorial/introduction)
- `sampler~` - Play audio samples
- `table` - Named float array storage

## Attribution

The Uiua WASM build is adapted from [Array Box](https://github.com/codereport/array-box)
by Conor Hoekstra (@codereport).
