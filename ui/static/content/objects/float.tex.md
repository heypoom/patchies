Pack `Float32Array` channel data into a live 32-bit float texture.

Inspired by TouchDesigner's CHOP to TOP operator, adapted for Patchies' message
and video-texture graph.

Send a single `Float32Array` to create one red-channel row, or send `Float32Array[]`
to treat each array as ordered channel data.

The format is inferred from channel count: `[r]`, `[r, g]`, `[r, g, b]`,
and `[r, g, b, a]` map to `r`, `rg`, `rgb`, and `rgba`.

If you already have interleaved RGBA pixel data, send an object with explicit
dimensions:

```js
send({
  data: rgba,
  width,
  height,
  format: "rgba",
})
```

In that form, `rgba.length` must be `width * height * 4`, and `float.tex`
uploads it without repacking.

Stores data as `rgba32f`, uses nearest filtering and fills missing
channels with `(0, 0, 0, 1)`.

To view it, connect the video outlet to `glsl>` or `hydra>`.

You can also connect `tap~` into `float.tex` to turn raw audio buffers into a
texture for waveform and audio-reactive shader experiments.

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

## Interleaved RGBA

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
  format: "rgba",
})
```

## See also

- [tap~](/docs/objects/tap~)
- [glsl](/docs/objects/glsl)
- [table](/docs/objects/table)
