# 57 - WebGPU Compute Node

**Status**: Design Complete
**Created**: 2026-02-02

## Overview

A `wgpu` node that enables WebGPU compute shaders in Patchies. Users write WGSL code to perform parallel data processing, with inputs/outputs automatically detected from shader bindings.

## Architecture

### Separate WebGPU Worker

WebGPU runs in a dedicated web worker, separate from the WebGL2 render worker:

- **No resource sharing** - WebGPU and WebGL2 can't share textures/buffers directly
- **Isolation** - WebGPU device crashes won't affect rendering
- **Parallelism** - Heavy compute won't block frame rendering

```
┌─────────────────────────────────────────────────────┐
│                    Main Thread                       │
├──────────┬──────────┬──────────┬───────────────────┤
│  wgpu    │  wgpu    │  wgpu    │                   │
│  node A  │  node B  │  node C  │  Message System   │
└────┬─────┴────┬─────┴────┬─────┴───────────────────┘
     │          │          │
     ▼          ▼          ▼
┌─────────────────────────────────────────────────────┐
│              WebGPU Compute Worker                   │
├─────────────────────────────────────────────────────┤
│  GPUDevice (shared)                                  │
│  Pipeline cache (keyed by shader hash)              │
│  Per-node state: { buffers, bindGroups }            │
└─────────────────────────────────────────────────────┘
```

### Single Shared Worker

All `wgpu` nodes share one worker instance:

- Single device initialization
- Pipeline reuse for identical shaders
- Simpler resource management

## Design Decisions

| Aspect | Decision |
|--------|----------|
| Output type | Data (TypedArrays via messages). Video frames deferred to future. |
| Input sources | Dynamic messages + static code buffers |
| Bindings | Auto-detect from WGSL parsing |
| TypedArray type | Auto-detect from WGSL (`array<f32>` → `Float32Array`) |
| Dispatch model | On-demand (bang trigger), auto-calculated from input size |
| Default shader | Noise generator |
| Error display | Virtual console (same pattern as GLSL node) |
| Unsupported browsers | Show node with "WebGPU not supported" error message |

## WGSL Binding Parser

Auto-detect inputs/outputs from WGSL code:

```ts
// src/lib/webgpu/wgsl-parser.ts

interface WGSLBinding {
  group: number;
  binding: number;
  name: string;
  accessMode: 'read' | 'read_write';
  type: string;                        // 'array<f32>', 'array<vec4f>', etc.
  elementType: string;                 // 'f32', 'vec4f', 'u32', etc.
  arrayConstructor: TypedArrayConstructor;
  componentsPerElement: number;        // vec4 = 4, scalar = 1
}

interface WGSLParseResult {
  bindings: WGSLBinding[];
  inputs: WGSLBinding[];               // accessMode === 'read'
  outputs: WGSLBinding[];              // accessMode === 'read_write'
  workgroupSize: [number, number, number] | null;
}

export function parseWGSL(code: string): WGSLParseResult {
  const bindings: WGSLBinding[] = [];

  // Match: @group(0) @binding(0) var<storage, read> name: array<f32>;
  const bindingRegex = /@group\((\d+)\)\s*@binding\((\d+)\)\s*var<storage,\s*(read|read_write)>\s*(\w+)\s*:\s*([^;]+)/g;

  let match;
  while ((match = bindingRegex.exec(code)) !== null) {
    const type = match[5].trim();
    const { constructor, components } = inferArrayType(extractElementType(type));
    bindings.push({
      group: parseInt(match[1]),
      binding: parseInt(match[2]),
      accessMode: match[3] as 'read' | 'read_write',
      name: match[4],
      type,
      elementType: extractElementType(type),
      arrayConstructor: constructor,
      componentsPerElement: components,
    });
  }

  // Extract workgroup_size from @compute @workgroup_size(x, y, z)
  const wgMatch = /@workgroup_size\((\d+)(?:,\s*(\d+))?(?:,\s*(\d+))?\)/.exec(code);
  const workgroupSize: [number, number, number] | null = wgMatch
    ? [parseInt(wgMatch[1]), parseInt(wgMatch[2] ?? '1'), parseInt(wgMatch[3] ?? '1')]
    : null;

  return {
    bindings: bindings.sort((a, b) => a.binding - b.binding),
    inputs: bindings.filter(b => b.accessMode === 'read'),
    outputs: bindings.filter(b => b.accessMode === 'read_write'),
    workgroupSize,
  };
}
```

## TypedArray Auto-Detection

Map WGSL types to JavaScript TypedArrays:

```ts
function inferArrayType(elementType: string): { constructor: TypedArrayConstructor; components: number } {
  return match(elementType)
    .with(P.union('f32', 'f16'), () => ({ constructor: Float32Array, components: 1 }))
    .with(P.union('u32'), () => ({ constructor: Uint32Array, components: 1 }))
    .with(P.union('i32'), () => ({ constructor: Int32Array, components: 1 }))
    .with(P.union('vec2f', 'vec2<f32>'), () => ({ constructor: Float32Array, components: 2 }))
    .with(P.union('vec3f', 'vec3<f32>'), () => ({ constructor: Float32Array, components: 3 }))
    .with(P.union('vec4f', 'vec4<f32>'), () => ({ constructor: Float32Array, components: 4 }))
    .with(P.union('vec2u', 'vec2<u32>'), () => ({ constructor: Uint32Array, components: 2 }))
    .with(P.union('vec3u', 'vec3<u32>'), () => ({ constructor: Uint32Array, components: 3 }))
    .with(P.union('vec4u', 'vec4<u32>'), () => ({ constructor: Uint32Array, components: 4 }))
    .otherwise(() => ({ constructor: Float32Array, components: 1 }));
}
```

## Auto Dispatch Calculation

Calculate dispatch count from input buffer size:

```ts
function calculateDispatchCount(
  inputSizes: number[],                    // byte lengths
  workgroupSize: [number, number, number],
  elementStride: number = 4                // bytes per element (f32 = 4)
): [number, number, number] {
  const maxElements = Math.max(...inputSizes) / elementStride;
  const threadsPerWorkgroup = workgroupSize[0] * workgroupSize[1] * workgroupSize[2];
  const numWorkgroups = Math.ceil(maxElements / threadsPerWorkgroup);

  // 1D dispatch by default
  return [numWorkgroups, 1, 1];
}
```

Users can override with explicit `dispatchCount` in node config if needed.

## Worker Message Protocol

```ts
// Main → Worker
type ToWorker =
  | { type: 'init' }
  | { type: 'compile'; nodeId: string; code: string }
  | { type: 'setBuffer'; nodeId: string; binding: number; data: ArrayBuffer }
  | { type: 'dispatch'; nodeId: string; dispatchCount?: [number, number, number] }
  | { type: 'destroy'; nodeId: string }

// Worker → Main
type FromWorker =
  | { type: 'ready'; supported: boolean }
  | { type: 'compiled'; nodeId: string; error?: string; bindings?: WGSLBinding[] }
  | { type: 'result'; nodeId: string; outputs: Record<number, ArrayBuffer> }
  | { type: 'error'; nodeId: string; message: string }
```

## Dispatch Flow

```
1. Node receives data on inlet 0 → sends setBuffer to worker
2. Node receives data on inlet 1 → sends setBuffer to worker
3. Node receives "bang" → sends dispatch to worker
4. Worker executes compute pass
5. Worker reads output buffers via mapAsync
6. Worker returns results as ArrayBuffers
7. Node wraps in appropriate TypedArray and sends as messages
```

## WebGPUComputeSystem API

```ts
// src/lib/webgpu/WebGPUComputeSystem.ts

class WebGPUComputeSystem {
  private worker: Worker;
  private pendingCallbacks: Map<string, (result: any) => void>;
  private supported: boolean | null = null;

  async init(): Promise<boolean>;

  async compile(nodeId: string, code: string): Promise<CompileResult>;

  setBuffer(nodeId: string, binding: number, data: ArrayBuffer): void;

  async dispatch(nodeId: string, dispatchCount?: [number, number, number]): Promise<DispatchResult>;

  destroy(nodeId: string): void;

  isSupported(): boolean;
}

export const webgpuSystem = new WebGPUComputeSystem();
```

## Node Component

```svelte
<!-- src/lib/components/nodes/WGPUNode.svelte -->
<script lang="ts">
  import { parseWGSL } from '$lib/webgpu/wgsl-parser';
  import VirtualConsole from '$lib/components/shared/VirtualConsole.svelte';

  let { id, data } = $props();

  let code = $state(data.code ?? DEFAULT_WGSL);
  let parseResult = $derived(parseWGSL(code));
  let consoleLines = $state<ConsoleLine[]>([]);

  // Auto-generate handles from parsed bindings
  let inputBindings = $derived(parseResult.inputs);
  let outputBindings = $derived(parseResult.outputs);

  // Handle incoming messages
  function handleMessage(binding: number, value: Float32Array | Uint32Array) {
    webgpuSystem.setBuffer(id, binding, value.buffer);
  }

  async function handleBang() {
    const result = await webgpuSystem.dispatch(id);
    if (result.error) {
      consoleLines = [...consoleLines, { type: 'error', text: result.error }];
    } else {
      // Send outputs as messages
      for (const [binding, buffer] of Object.entries(result.outputs)) {
        const bindingInfo = outputBindings.find(b => b.binding === Number(binding));
        const TypedArray = bindingInfo?.arrayConstructor ?? Float32Array;
        send(bindingInfo?.name ?? `out${binding}`, new TypedArray(buffer));
      }
    }
  }
</script>

{#each inputBindings as binding, i}
  <StandardHandle
    port="inlet"
    type="message"
    id={`in-${binding.binding}`}
    title={binding.name}
    index={i}
    total={inputBindings.length + 1}
  />
{/each}
<StandardHandle port="inlet" type="message" id="bang" title="bang" index={inputBindings.length} total={inputBindings.length + 1} />

<div class="node-content">
  <CodeEditor language="wgsl" bind:value={code} />
  <VirtualConsole lines={consoleLines} />
</div>

{#each outputBindings as binding, i}
  <StandardHandle
    port="outlet"
    type="message"
    id={`out-${binding.binding}`}
    title={binding.name}
    index={i}
    total={outputBindings.length}
  />
{/each}
```

## Default Shader: Noise Generator

```wgsl
// Generate pseudo-random noise from input indices
// Input: array of seed values (or just use for output size)
// Output: array of random f32 values in [0, 1]

@group(0) @binding(0) var<storage, read> seeds: array<f32>;
@group(0) @binding(1) var<storage, read_write> noise: array<f32>;

// Hash function for randomness
fn hash(p: u32) -> f32 {
  var h = p * 747796405u + 2891336453u;
  h = ((h >> 16u) ^ h) * 2246822507u;
  h = ((h >> 16u) ^ h) * 3266489909u;
  return f32(h >> 16u) / 65535.0;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= arrayLength(&seeds)) { return; }

  // Combine index with seed for variety
  let seed = bitcast<u32>(seeds[idx]);
  noise[idx] = hash(idx + seed);
}
```

## Files to Create

```
src/lib/webgpu/
├── WebGPUComputeSystem.ts    # Singleton manager
├── wgsl-parser.ts            # Parse bindings, types
└── types.ts                  # Shared types

src/lib/workers/
└── webgpu-compute-worker.ts  # Worker

src/lib/components/nodes/
└── WGPUNode.svelte           # Node component

src/lib/codemirror/
└── wgsl.ts                   # WGSL syntax support (if needed)

src/lib/ai/object-prompts/
└── wgpu.ts                   # AI prompt
```

## Files to Modify

- `src/lib/nodes/node-types.ts` - Add `'wgpu'`
- `src/lib/nodes/defaultNodeData.ts` - Default config
- `src/lib/components/object-browser/get-categorized-objects.ts` - Add to category
- `src/lib/ai/object-descriptions-types.ts` - Add to type list
- `src/lib/ai/object-prompts/index.ts` - Register prompt

## Browser Support

WebGPU is not available in all browsers. When unsupported:

- Node appears normally in object browser
- Node displays "WebGPU not supported in this browser" in virtual console
- All functionality gracefully disabled

## Future Considerations

### Video Frame Output (Deferred)

To output video frames to the WebGL2 pipeline:

1. Compute shader writes RGBA pixels to output buffer
2. Worker reads buffer and transfers as `ImageData` or raw pixels
3. Main thread creates/updates WebGL2 texture from pixel data
4. Texture feeds into existing video pipeline

This requires pixel data copy (no direct sharing between WebGPU/WebGL2).

### Continuous Dispatch Mode (Future)

Add configuration option to dispatch continuously:

```ts
interface WGPUNodeConfig {
  dispatchMode: 'on-demand' | 'continuous';
  targetFps?: number;  // for continuous mode
}
```
