# 99. Schema-Driven Handles

## Summary

Replace the implicit handle ID derivation (scattered across 199 `StandardHandle` usages) with declarative handle specs in the existing `ObjectSchema` system. Introduce a `TypedHandle` component that reads from schemas, and a shared `deriveHandleId()` function used by both `TypedHandle` and AI code generation.

## Motivation

Handle IDs are currently implicit — derived by `StandardHandle` from prop combinations (`type`, `id`, `port`) at render time. The AI has no reliable way to know what handle IDs a node will produce, leading to broken edge connections in multi-object generation. A manually-maintained `handle-specs.ts` exists for eval/debug, but it duplicates knowledge and drifts from reality.

**Core problem**: There is no single source of truth for handle IDs.

## Design

### 1. `deriveHandleId()` — Pure Function

Extract the handle ID derivation logic from `StandardHandle.svelte` (lines 49-57) into a pure, importable function:

```ts
// src/lib/utils/handle-id.ts

export type PortDirection = 'inlet' | 'outlet';
export type HandleType = 'video' | 'audio' | 'message' | 'analysis';

export interface HandleProps {
  port: PortDirection;
  type?: HandleType;
  id?: string | number;
}

export function deriveHandleId(props: HandleProps): string {
  const portDir = props.port === 'inlet' ? 'in' : 'out';

  if (props.type != null && props.id != null) return `${props.type}-${portDir}-${props.id}`;
  if (props.type != null) return `${props.type}-${portDir}`;
  if (props.id != null) return `${portDir}-${props.id}`;
  return props.port; // fallback: 'inlet' or 'outlet'
}
```

`StandardHandle` is refactored to call `deriveHandleId()` internally. Zero behavior change.

### 2. Handle Spec in `ObjectSchema`

Extend `InletSchema` and `OutletSchema` with optional handle metadata:

```ts
// Added to types.ts

export interface HandleSpec {
  /** Handle type for coloring and ID derivation */
  handleType?: HandleType;
  /** Explicit ID segment (combined with handleType + portDir to produce final handle ID) */
  handleId?: string | number;
}

export interface InletSchema {
  // ... existing fields ...
  handle?: HandleSpec;
}

export interface OutletSchema {
  // ... existing fields ...
  handle?: HandleSpec;
}
```

For **static handles**, the final xyflow handle ID is computed as:
```ts
deriveHandleId({
  port: 'inlet', // or 'outlet'
  type: schema.handle?.handleType,
  id: schema.handle?.handleId
})
```

Examples:

| Schema handle spec | Derived handle ID |
|---|---|
| `{ handleType: 'message' }` | `message-in` |
| `{ handleType: 'audio', handleId: 0 }` | `audio-in-0` |
| `{ handleId: 0 }` | `in-0` |
| `{ handleType: 'video', handleId: '0' }` | `video-out-0` |
| _(omitted)_ | falls back to port direction |

### 3. Handle Patterns for Dynamic Nodes

Some nodes have handles that depend on runtime state (inlet count, GLSL uniforms, etc.). For these, add a `handlePatterns` field to `ObjectSchema`:

```ts
export interface HandlePattern {
  /** Template string with `{index}` placeholder, e.g. 'in-{index}', 'video-in-{index}-{name}-{type}' */
  template: string;
  /** Handle type for coloring */
  handleType?: HandleType;
  /** Human-readable description of what varies */
  description?: string;
}

export interface ObjectSchema {
  // ... existing fields ...
  /** Dynamic handle patterns for AI context (when inlets/outlets are runtime-determined) */
  handlePatterns?: {
    inlet?: HandlePattern;
    outlet?: HandlePattern;
  };
}
```

Examples:

| Node type | Pattern |
|---|---|
| `p5` | inlet: `{ template: 'in-{index}' }`, outlet: `{ template: 'video-out-{index}', handleType: 'video' }` |
| `glsl` | inlet: `{ template: 'video-in-{index}-{name}-{type}', handleType: 'video' }` |
| `js` | inlet: `{ template: 'in-{index}' }`, outlet: `{ template: 'out-{index}' }` |
| `tone~` | inlet: `{ template: 'audio-in-{index}', handleType: 'audio' }`, outlet: `{ template: 'audio-out-{index}', handleType: 'audio' }` |

### 4. `TypedHandle` Component

A new component that reads handle specs from schemas and delegates to `StandardHandle`:

```svelte
<!-- src/lib/components/TypedHandle.svelte -->
<script lang="ts">
  import StandardHandle from './StandardHandle.svelte';
  import type { HandleSpec } from '$lib/objects/schemas/types';

  interface Props {
    port: 'inlet' | 'outlet';
    /** Handle spec from the schema — replaces manual type/id props */
    spec: HandleSpec;
    total: number;
    index: number;
    title?: string;
    class?: string;
    nodeId: string;
    isAudioParam?: boolean;
    acceptsFloat?: boolean;
    isHot?: boolean;
  }

  let { spec, ...rest }: Props = $props();
</script>

<StandardHandle
  type={spec.handleType}
  id={spec.handleId}
  {...rest}
/>
```

Usage comparison:

```svelte
<!-- Before (manual props, error-prone) -->
<StandardHandle port="outlet" type="video" id="0" total={1} index={0} nodeId={node.id} />

<!-- After (schema-driven) -->
<TypedHandle port="outlet" spec={schema.outlets[0].handle} total={1} index={0} nodeId={node.id} />
```

`TypedHandle` is a thin wrapper — the heavy lifting stays in `StandardHandle`.

### 5. AI Handle Context Generation

At build time (alongside `generate:schemas`), generate a handle ID reference that gets injected into AI prompts:

```ts
// scripts/generate-handle-docs.ts (or extend generate-object-schemas.ts)

function generateHandleDoc(schema: ObjectSchema): string {
  const lines: string[] = [];

  for (const inlet of schema.inlets) {
    if (inlet.handle) {
      const id = deriveHandleId({ port: 'inlet', ...inlet.handle });
      lines.push(`  inlet: "${id}" (${inlet.description})`);
    }
  }
  for (const outlet of schema.outlets) {
    if (outlet.handle) {
      const id = deriveHandleId({ port: 'outlet', ...outlet.handle });
      lines.push(`  outlet: "${id}" (${outlet.description})`);
    }
  }
  if (schema.handlePatterns?.inlet) {
    lines.push(`  inlet pattern: "${schema.handlePatterns.inlet.template}"`);
  }
  if (schema.handlePatterns?.outlet) {
    lines.push(`  outlet pattern: "${schema.handlePatterns.outlet.template}"`);
  }

  return `${schema.type}:\n${lines.join('\n')}`;
}
```

This produces output like:
```text
slider:
  inlet: "message-in" (Control messages)
  outlet: "message-out" (Slider output)
gain~:
  inlet: "audio-in-in" (Audio input)
  inlet: "audio-in-gain" (Gain control)
  outlet: "audio-out-out" (Audio output)
p5:
  inlet pattern: "in-{index}"
  outlet pattern: "video-out-{index}"
glsl:
  inlet pattern: "video-in-{index}-{name}-{type}"
  outlet: "video-out" (Video output)
```

The AI multi-object generator injects this as part of its system prompt, replacing the manually-maintained handle ID instructions.

### 6. Schema Propagation

For **V2 nodes** (audio + text objects), handle specs are derived from existing `ObjectInlet`/`ObjectOutlet` metadata. Extend `from-v2-node.ts`:

```ts
function inletToSchema(inlet: ObjectInlet, index: number, allInlets: ObjectInlet[]): InletSchema {
  // ... existing logic ...

  // Derive handle spec from inlet metadata
  const handle = deriveHandleSpec(inlet, index, allInlets);

  return { id, type: inlet.type, description, messages, isAudioParam: inlet.isAudioParam, handle };
}

function deriveHandleSpec(inlet: ObjectInlet, index: number, allInlets: ObjectInlet[]): HandleSpec {
  // Audio nodes: type='audio', id=name
  if (inlet.type === 'signal') {
    return { handleType: 'audio', handleId: inlet.name ?? index };
  }
  // Message-only nodes with single inlet: type='message', no id
  if (allInlets.length === 1 && inlet.type === 'message') {
    return { handleType: 'message' };
  }
  // Indexed: no type, id=index
  return { handleId: index };
}
```

For **manual schemas** (p5, glsl, hydra, etc.), handle specs are added directly to the schema files.

## Migration Plan

### Phase 1: Foundation (no migration needed)

1. Create `src/lib/utils/handle-id.ts` with `deriveHandleId()`
2. Refactor `StandardHandle.svelte` to use `deriveHandleId()` internally
3. Add `HandleSpec` and `HandlePattern` types to `schemas/types.ts`
4. Create `TypedHandle.svelte` component

### Phase 2: Populate Schemas

5. Extend `from-v2-node.ts` to auto-derive `HandleSpec` for V2 nodes (~110 audio + control objects)
6. Add `handle` specs to manual schemas (p5, glsl, hydra, three, canvas, webcam, etc.)
7. Add `handlePatterns` to dynamic schemas (p5, glsl, js, tone~, dsp~, etc.)

### Phase 3: AI Integration

8. Generate handle ID docs from schemas (extend `generate:schemas` script)
9. Replace manual handle ID instructions in AI multi-object prompts with generated docs
10. Update eval suite to validate against schema-derived handle IDs instead of `handle-specs.ts`
11. Remove `handle-specs.ts` (replaced by schemas)

### Phase 4: Gradual Component Migration

12. Migrate high-traffic nodes to `TypedHandle` first: slider, msg, toggle, button, out~, object
13. Continue migration node-by-node (199 instances total, no rush)
14. `StandardHandle` remains indefinitely — `TypedHandle` is sugar, not a replacement

## Nodes by Handle Complexity

**Static (easiest to migrate)**:
- Single message in/out: `slider`, `msg`, `toggle`, `button`, `knob`, `textbox`, `keyboard`, `label`
- Single audio in/out: `mic~`, `out~`, `meter~`, `scope~`
- Fixed multi-port: `sampler~`, `soundfile~`, `bytebeat~`

**Semi-dynamic (handle spec + pattern)**:
- Video chain: `p5`, `hydra`, `glsl`, `three`, `canvas`, `bg.out`, `webcam`
- Audio with message: `strudel`, `orca`, `chuck~`, `csound~`

**Fully dynamic (pattern only)**:
- Runtime port count: `js`, `worker`, `tone~`, `dsp~`, `elem~`, `split~`, `merge~`
- GLSL uniforms: composite handle IDs from uniform introspection

## Non-Goals

- Changing how `StandardHandle` works internally (beyond extracting `deriveHandleId`)
- Removing `StandardHandle` — it stays, `TypedHandle` wraps it
- Migrating all 199 instances at once
- Changing handle ID format or wire protocol
