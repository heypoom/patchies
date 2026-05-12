Pack `Float32Array` channel data into a live 32-bit float texture.

Inspired by TouchDesigner's CHOP to TOP operator, adapted for Patchies' message
and video-texture graph.

Send a single `Float32Array` to create one red-channel row, or send `Float32Array[]`
to treat each array as ordered channel data. The format is inferred from channel
count: `[r]`, `[r, g]`, `[r, g, b]`, and `[r, g, b, a]` map to `r`, `rg`,
`rgb`, and `rgba`.

Wrapped and square channel layouts can read channels from `Float32Array`,
`Float32Array[]`, `SharedArrayBuffer`, or `SharedArrayBuffer[]`. When a layout
uses shared channels, send `version` and bump it after writing new samples to
skip repeated uploads for the same buffer contents.

Object-shaped messages can set `textureFormat` to choose the output texture
storage: `"rgba32f"` by default, `"rgba16f"` for half-float storage, or
`"rgba8"` for clamped 8-bit storage.

For long channel rows, use `type: "wrapped"` to continue samples on additional
rows:

```js
send({
  type: "wrapped",
  channels: [r, g, b, a],
  width: 256,
})
```

For point-cloud or particle-style data, use `type: "square"` to pack channel
groups into an approximately square texture:

```js
send({
  type: "square",
  channels: [x, y, z, w],
})
```

If you already have interleaved pixel data, send an object with explicit
dimensions. `type` can be `"r"`, `"rg"`, `"rgb"`, or `"rgba"`:

```js
send({
  data: rgba,
  width,
  height,
  type: "rgba",
})
```

In that form, `rgba.length` must be `width * height * 4`, and `float.tex`
uploads it without repacking. Interleaved `"r"`, `"rg"`, and `"rgb"` data is
expanded to RGBA internally.

For shared interleaved data, send a `SharedArrayBuffer` and bump `version` whenever
the producer has finished writing a new frame:

```js
send({
  buffer,
  width,
  height,
  type: "rgba",
  version,
})
```

`float.tex` skips repeated messages for the same shared buffer and version.

Stores data as `rgba32f`, uses nearest filtering and fills missing
channels with `(0, 0, 0, 1)`.

To view it, connect the video outlet to `glsl>` or `hydra>`.

You can also connect `tap~` into `float.tex` to turn raw audio buffers into a
texture for waveform and audio-reactive shader experiments.

## Preset Pack

Enable the **Float Texture Data** preset pack for ready-made JS generators that
send texture data into `float.tex`:

- `rgba-grid.float.js` — 50×50 interleaved RGBA pixel data.
- `square-field.float.js` — square-packed XYZW point-field data.
- `wrapped-wave.float.js` — wrapped RGBA channel rows.
- `Square Field Preview` — GLSL preview for `square-field.float.js`.

Create one of those presets, connect it to `float.tex`, then connect `float.tex`
to `glsl>` to inspect the texture.

For `square-field.float.js`, the raw texture is data storage, not the final
image. Patch it like this:

```text
[square-field.float.js] → [float.tex] → [Square Field Preview]
```

The JS preset stores each point as `x`, `y`, `z`, `w` channels. The preview
shader reads those channels as positions and draws the field as points.

## Planar RGBA Channels

```js
setRunOnMount(true)

function produce(S) {
  let r = new Float32Array(S)
  let g = new Float32Array(S)
  let b = new Float32Array(S)
  let a = new Float32Array(S)

  for (let i = 0; i < S; i++) {
    let t = i / (S - 1)
    r[i] = t
    g[i] = 0
    b[i] = 1 - t
    a[i] = 1
  }

  send([r, g, b, a])
}

produce(10)

recv((data, meta) => {
  produce(data)
})
```

## Wrapped Rows

```js
setRunOnMount(true)

let S = 1024
let r = new Float32Array(S)
let g = new Float32Array(S)
let b = new Float32Array(S)
let a = new Float32Array(S)

for (let i = 0; i < S; i++) {
  let t = i / (S - 1)

  r[i] = t
  g[i] = 0
  b[i] = 1 - t
  a[i] = 1
}

send({
  type: "wrapped",
  channels: [r, g, b, a],
  width: 128,
  textureFormat: "rgba16f",
})
```

## Square Channels

```js
setRunOnMount(true)

let S = 40 ** 2
let x = new Float32Array(S)
let y = new Float32Array(S)
let z = new Float32Array(S)
let w = new Float32Array(S)

for (let i = 0; i < S; i++) {
  let t = i / S
  let angle = t * Math.PI * 2 * 12

  x[i] = Math.cos(angle) * t
  y[i] = Math.sin(angle) * t
  z[i] = t
  w[i] = 1
}

send({
  type: "square",
  channels: [x, y, z, w],
})
```

## Interleaved Pixels

```js
setRunOnMount(true)

let width = 50
let height = 50
let rgba = new Float32Array(width * height * 4)

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let i = (y * width + x) * 4

    let u = x / (width - 1)
    let v = y / (height - 1)

    rgba[i + 0] = u
    rgba[i + 1] = v
    rgba[i + 2] = 1 - u
    rgba[i + 3] = 1
  }
}

send({
  data: rgba,
  width,
  height,
  type: "rgba",
  textureFormat: "rgba8",
})
```

## Shared Interleaved Buffer

```js
setRunOnMount(true)

let width = 50
let height = 50
let buffer = new SharedArrayBuffer(width * height * 4 * Float32Array.BYTES_PER_ELEMENT)
let rgba = new Float32Array(buffer)
let version = 0

function produce() {
  version++

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = (y * width + x) * 4
      let u = x / (width - 1)
      let v = y / (height - 1)
      let pulse = (Math.sin(version * 0.08) + 1) * 0.5

      rgba[i + 0] = u
      rgba[i + 1] = v
      rgba[i + 2] = pulse
      rgba[i + 3] = 1
    }
  }

  send({ buffer, width, height, type: "rgba", version })
}

setInterval(() => {
  produce()
}, 1000 / 24)
```

## See also

- [tap~](/docs/objects/tap~)
- [glsl](/docs/objects/glsl)
- [table](/docs/objects/table)
