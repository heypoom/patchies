Run parallel computations on the GPU using
[WGSL](https://www.w3.org/TR/WGSL/) (WebGPU Shading Language).

Great for data-parallel operations like noise generation, matrix math, and
array processing.

Requires browser with WebGPU support (Chrome 113+, Edge 113+, Firefox Nightly).

## How It Works

1. Write a WGSL compute shader with `@group(0) @binding(N)` storage buffers
2. Input buffers use `var<storage, read>`, output buffers use
   `var<storage, read_write>`
3. The node auto-detects bindings and creates inlet/outlet handles
4. Send typed arrays (Float32Array, Uint32Array, etc.) to input inlets
5. Send `bang` to the leftmost inlet to trigger computation
6. Results are outputted as typed arrays

## Data Types

- `array<f32>` → Float32Array
- `array<u32>` → Uint32Array
- `array<i32>` → Int32Array
- `array<vec2f>` → Float32Array (2 components per element)
- `array<vec4f>` → Float32Array (4 components per element)

## Example

```wgsl
// Double all input values
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= arrayLength(&input)) { return; }
  output[idx] = input[idx] * 2.0;
}
```

## See Also

- [glsl](/docs/objects/glsl) - GLSL fragment shaders
- [js](/docs/objects/js) - JavaScript processing
