# 100. Schema-Driven Handles

## Status: Implemented

**Eval results**: 66/67 pass (99%) — up from ~76% before this work.

## Summary

Handle IDs are now schema-driven. Each `ObjectSchema` declares handle specs (`handle: { handleType, handleId? }`) and optional `handlePatterns` for dynamic ports. A shared `deriveHandleId()` function computes handle IDs consistently across components, AI code generation, and debug tooling.

## Architecture

### `deriveHandleId()` — Pure Function

```ts
// src/lib/utils/handle-id.ts
export function deriveHandleId(props: HandleProps): string {
  const portDir = props.port === 'inlet' ? 'in' : 'out';
  if (props.type != null && props.id != null) return `${props.type}-${portDir}-${props.id}`;
  if (props.type != null) return `${props.type}-${portDir}`;
  if (props.id != null) return `${portDir}-${props.id}`;
  return props.port;
}
```

### Handle Spec in `ObjectSchema`

Each inlet/outlet can declare a `handle` field:

```ts
export interface HandleSpec {
  handleType?: 'video' | 'audio' | 'message' | 'analysis';
  handleId?: string | number;
}
```

| Schema handle spec | Derived handle ID |
|---|---|
| `{ handleType: 'message' }` | `message-in` / `message-out` |
| `{ handleType: 'audio', handleId: 0 }` | `audio-in-0` / `audio-out-0` |
| `{ handleId: 0 }` | `in-0` / `out-0` |
| `{ handleType: 'video', handleId: '0' }` | `video-in-0` / `video-out-0` |

### Handle Patterns for Dynamic Nodes

Nodes with runtime-determined ports use `handlePatterns`:

```ts
handlePatterns?: {
  inlet?: { template: string; handleType?: HandleType; description?: string };
  outlet?: { template: string; handleType?: HandleType; description?: string };
}
```

Examples: `tone~` has fixed `audio-in`/`audio-out` handles plus dynamic `message-in-{index}`/`message-out-{index}` patterns.

### `TypedHandle` Component

Thin wrapper over `StandardHandle` that takes a `spec: HandleSpec` prop:

```svelte
<TypedHandle port="outlet" spec={schema.outlets[0].handle!} total={1} index={0} {nodeId} />
```

### AI Handle Context Generation

`generateHandleDocs()` in `src/lib/ai/generate-handle-docs.ts` derives handle ID reference from schemas at runtime. Injected into multi-object prompts as `HANDLE ID REFERENCE`.

### Debug Validation

`handle-specs.ts` auto-derives fixed handle patterns from schemas via `deriveSpecFromSchema()`. Only nodes with dynamic/indexed ports or no schema (e.g., `label`) need manual entries in `MANUAL_HANDLE_SPECS`.

## What Was Done

### Phase 1: Foundation
- Created `src/lib/utils/handle-id.ts` with `deriveHandleId()`
- Refactored `StandardHandle.svelte` to use `deriveHandleId()` internally
- Added `HandleSpec` and `HandlePattern` types to `schemas/types.ts`
- Created `TypedHandle.svelte` component

### Phase 2: Schema Population
- Extended `from-v2-node.ts` to auto-derive `HandleSpec` for V2 nodes
- Added `handle` specs to manual schemas (webcam, ai.txt, ai.img, tts, midi.in, etc.)
- Added `handlePatterns` to dynamic schemas (sequencer, glsl, tone~, dsp~, etc.)
- Added missing audio outlets to tone~/elem~/sonic~ schemas
- Fixed schema mismatches: sampler~ redundant handleIds, expr~ missing outlet, csound~ handle IDs

### Phase 3: AI Integration
- `generateHandleDocs()` replaces manual handle ID instructions in prompts
- `handle-specs.ts` refactored to auto-derive from schemas (SCHEMA_DERIVABLE_TYPES)
- Only ~15 manual entries remain (dynamic/indexed nodes like msg, js, worker, hydra, etc.)
- Eval suite validates against schema-derived handle IDs

### Phase 4: Migration & Fixes
- Created migration `011-fix-redundant-handle-ids.ts` for backwards compatibility
- Fixed component bugs: sampler~ redundant handleIds, fexpr~ audio-out-audio-out, chuck~ outlet index
- Fixed eval cases: corrected type names (ai.txt/ai.img/ai.tts), removed label targets (no handles)

## Remaining

- `handle-specs.ts` still exists for debug validation — could eventually be replaced by direct schema lookups
- 1 eval case still fails intermittently (`tricky-expr-indexed-inlets` — AI generates `message-in` instead of `message-in-0`)
- Not all components migrated to `TypedHandle` yet (gradual, no rush)
