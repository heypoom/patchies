export const wgpuPrompt = `## wgpu Object Instructions

WebGPU compute shader node for parallel data processing using WGSL.

CRITICAL RULES:
1. Write WGSL compute shaders, NOT GLSL
2. Use \`@group(0) @binding(N) var<storage, read>\` for inputs
3. Use \`@group(0) @binding(N) var<storage, read_write>\` for outputs
4. Must have a \`@compute @workgroup_size(N)\` entry point named \`main\`
5. Inputs/outputs are auto-detected from shader bindings

DATA FLOW:
- Input handles are created from \`read\` storage bindings
- Output handles are created from \`read_write\` storage bindings
- A "bang" inlet triggers compute dispatch
- Send TypedArrays (Float32Array, Uint32Array, etc.) to input handles
- Outputs are sent as TypedArrays on outlet handles

HANDLE IDS (Auto-generated from WGSL bindings):
- Input inlets: "message-in-in-{bindingNumber}" (e.g., "message-in-in-0" for @binding(0))
- Bang inlet: "message-in-bang"
- Output outlets: "message-in-out-{bindingNumber}" (e.g., "message-out-out-1" for @binding(1))

WGSL TYPE MAPPING:
- array<f32> → Float32Array
- array<u32> → Uint32Array
- array<i32> → Int32Array
- array<vec2f> → Float32Array (2 components per element)
- array<vec4f> → Float32Array (4 components per element)

Example - Noise Generator:
\`\`\`json
{
  "type": "wgpu",
  "data": {
    "code": "@group(0) @binding(0) var<storage, read> seeds: array<f32>;\\n@group(0) @binding(1) var<storage, read_write> noise: array<f32>;\\n\\nfn hash(p: u32) -> f32 {\\n  var h = p * 747796405u + 2891336453u;\\n  h = ((h >> 16u) ^ h) * 2246822507u;\\n  h = ((h >> 16u) ^ h) * 3266489909u;\\n  return f32(h >> 16u) / 65535.0;\\n}\\n\\n@compute @workgroup_size(64)\\nfn main(@builtin(global_invocation_id) gid: vec3<u32>) {\\n  let idx = gid.x;\\n  if (idx >= arrayLength(&seeds)) { return; }\\n  noise[idx] = hash(idx + bitcast<u32>(seeds[idx]));\\n}"
  }
}
\`\`\`

Example - Double Values:
\`\`\`json
{
  "type": "wgpu",
  "data": {
    "code": "@group(0) @binding(0) var<storage, read> input: array<f32>;\\n@group(0) @binding(1) var<storage, read_write> output: array<f32>;\\n\\n@compute @workgroup_size(64)\\nfn main(@builtin(global_invocation_id) gid: vec3<u32>) {\\n  let idx = gid.x;\\n  if (idx >= arrayLength(&input)) { return; }\\n  output[idx] = input[idx] * 2.0;\\n}"
  }
}
\`\`\`

USAGE PATTERN:
1. Connect a msg node with Float32Array data to input handles
2. Connect output handles to peek nodes to see results
3. Send "bang" to the bang inlet to trigger computation
4. WebGPU must be supported by the browser`;
