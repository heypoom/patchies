# 103. SuperSonic Metrics Node (`sonic.metrics`)

## Overview

A dedicated display node that shows real-time SuperSonic performance metrics. Polls `sonic.getMetrics()` (a cheap local memory read) and renders key stats in a compact, dark-themed layout. Optionally emits metrics as messages on its outlet for downstream nodes to react to.

## Design

### Node Type

- **Name**: `sonic.metrics`
- **Category**: Music (same pack as `sonic~`)
- **Pattern**: Direct visual node (like `meter~` / `peek`) — no layout wrapper

### Handles

- **Inlet**: 1 message inlet (for bang to request metrics snapshot, or `set refreshRate <n>`)
- **Outlet**: 1 message outlet (emits metrics object on each poll tick, or on bang)

### Data

```typescript
{
  refreshRate: number;    // Hz, default 10
  autoEmit: boolean;      // whether to emit metrics on outlet each tick (default false)
}
```

### SuperSonic Access

Add `getSonicIfReady()` to `SuperSonicManager` — returns the instance if already initialized, `null` otherwise. This avoids triggering lazy-load from a metrics-only node.

### Metrics Display

Compact text-based grid showing key metrics grouped into sections:

| Section | Metrics |
|---------|---------|
| **Engine** | audioContext state, loaded synth defs |
| **scsynth** | process count, messages processed, messages dropped |
| **Scheduler** | depth / peak / capacity, lates, dropped |
| **OSC** | in messages/bytes, out messages/bytes |
| **Buffers** | in/out buffer usage % |
| **Errors** | WASM errors, corrupted messages |

Values update at the configured refresh rate. Error/warning values highlight in red/amber.

### Message Protocol

**Inlet messages:**
- `bang` — emit current metrics snapshot on outlet
- `['set', 'refreshRate', n]` — change poll rate
- `['set', 'autoEmit', bool]` — toggle auto-emit

**Outlet messages:**
- Full metrics object from `getMetrics()` (on bang or auto-emit tick)

### States

1. **Waiting** — SuperSonic not initialized yet. Shows "Waiting for sonic~..." placeholder
2. **Connected** — Polling and displaying metrics
3. **Error** — SuperSonic errored during init (unlikely from this node since we don't trigger init)

## Files

| File | Action |
|------|--------|
| `src/lib/audio/SuperSonicManager.ts` | Add `getSonicIfReady()` |
| `src/lib/components/nodes/SonicMetricsNode.svelte` | Create component |
| `src/lib/nodes/node-types.ts` | Register `sonic.metrics` |
| `src/lib/nodes/defaultNodeData.ts` | Default data |
| `src/lib/extensions/object-packs.ts` | Add to music pack |
| `src/lib/objects/schemas/sonic-metrics.ts` | Manual schema |
| `src/lib/objects/schemas/index.ts` | Register schema |
| `src/lib/ai/object-descriptions-types.ts` | AI description |
| `static/content/objects/sonic.metrics.md` | Documentation |
