Pack `Float32Array` channel data into a live 32-bit float texture.

Inspired by TouchDesigner's CHOP to TOP operator, adapted for Patchies' message
and video-texture graph.

Send a single `Float32Array` to create one red-channel row, or send `Float32Array[]`
to treat each array as ordered channel data.

The format is inferred from channel count: `[r]`, `[r, g]`, `[r, g, b]`,
and `[r, g, b, a]` map to `r`, `rg`, `rgb`, and `rgba`.

Stores data as `rgba32f`, uses nearest filtering and fills missing
channels with `(0, 0, 0, 1)`.

To view it, connect the video outlet to `glsl>` or `hydra>`.

You can also connect `tap~` into `float.tex` to turn raw audio buffers into a
texture for waveform and audio-reactive shader experiments.

## Example

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

## See also

- [tap~](/docs/objects/tap~)
- [glsl](/docs/objects/glsl)
- [table](/docs/objects/table)
