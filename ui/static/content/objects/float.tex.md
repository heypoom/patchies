Pack `Float32Array` channel data into a live 32-bit float texture.

Send a single `Float32Array` to create one red-channel row, or send `Float32Array[]`
to treat each array as ordered channel data.

The format is inferred from channel count: `[r]`, `[r, g]`, `[r, g, b]`,
and `[r, g, b, a]` map to `r`, `rg`, `rgb`, and `rgba`.

Stores data as `rgba32f`, uses nearest filtering and fills missing
channels with `(0, 0, 0, 1)`.

To view it, connect the video outlet to `glsl>` or `hydra>`.

## See also

- [tap~](/docs/objects/tap~)
- [glsl](/docs/objects/glsl)
- [table](/docs/objects/table)
