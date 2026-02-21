Runs [Uiua](https://www.uiua.org/) code, a stack-based array programming language.

![Uiua multimedia demo](/content/images/uiua-multimedia.webp)

## Outputs

Uiua can output multiple data types:

- **Message outlet**: Text, arrays, and audio samples (`Float32Array`)
- **Video outlet**: Images and GIFs (enable in settings)

### Images and GIFs

Enable the video outlet in settings to send images and GIFs through the
video pipeline. Static images and animated GIFs are both supported.

### Audio Samples

Uiua can generate audio as WAV data. When output through the message outlet,
audio is automatically decoded to `Float32Array` which can be connected
directly to:

- [sampler~](/docs/objects/sampler~) - Load samples for playback
- [table](/docs/objects/table) - Store in a named buffer for use with [tabread~](/docs/objects/tabread~)

## Preview, Settings, and Glyph Palette

Click the **⋮** menu (top-right when selected) to access:

- **Preview**: View output images, GIFs, SVGs, and play audio
- **Settings**: Toggle message/video outlets
- **Glyphs**: Toggle the glyph insertion palette

## Glyph Palette

![Uiua glyph palette demo](/content/images/uiua-glyph-palette.webp)

Enable the glyph palette from the **⋮** menu to show a clickable grid of all
Uiua glyphs below the editor. Glyphs are grouped by category (Stack, Monadic,
Dyadic, 1-Modifier, 2-Modifier, Constants) and color-coded to match the
syntax highlighting.

- **Click** a glyph to insert it at the cursor position
- **Shift+click** a glyph to open its documentation on [uiua.org](https://www.uiua.org/docs)
- **Hover** over a glyph to see its name, type, signature, and description

The palette is only visible while editing and is not persisted in the node data.

## Glyph Hover Docs

![Uiua glyph hover docs demo](/content/images/uiua-hover-docs.webp)

Hover over any Uiua glyph in the code editor to see inline documentation
showing the glyph's name, type, signature, and description.

## Auto-formatting

Press Shift+Enter to format your code using Uiua's built-in formatter.

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

## See also

- [Array Box](https://arraybox.dev) - really nice website to edit and run Uiua code
- [Uiua website](https://www.uiua.org)
- [Uiua documentation](https://www.uiua.org/docs)
- [Uiua tutorial](https://www.uiua.org/tutorial/introduction)
- `sampler~` - Play audio samples
- `table` - Named float array storage

## Attribution

The Uiua WASM build is adapted from [Array Box](https://github.com/codereport/array-box)
by Conor Hoekstra (@codereport).
