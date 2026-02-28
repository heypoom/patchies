# 84. Timeline Visualizer

## Overview

A canvas-based timeline ruler inside the TransportPanel that visualizes scheduled clock events (`onBeat`, `schedule`, `every`) with per-node colors and fire-flash feedback.

## Architecture

### SchedulerRegistry (singleton)

Tracks all active `LookaheadClockScheduler` instances keyed by nodeId.

```typescript
interface ScheduledEventDescriptor {
  id: string;
  kind: 'beat' | 'schedule' | 'every';
  beats?: number[] | '*';
  time?: number;
  interval?: number;
  lastFired?: number;
  fired?: boolean;
}

interface FiredEventRecord {
  id: string;
  firedAt: number;    // transport time
  wallTime: number;   // performance.now() for animation decay
}
```

Methods:

- `register(nodeId, scheduler)` / `unregister(nodeId)`
- `getAllEvents()` → `Map<nodeId, ScheduledEventDescriptor[]>`
- `getAllFiredEvents()` → `Map<nodeId, FiredEventRecord[]>` (drains buffer)

### Scheduler Introspection

`LookaheadClockScheduler` gains:

- `getEventSnapshot()` — returns descriptors from the three internal Maps (no callback references)
- `drainFiredEvents()` — returns and clears a ring buffer (max 64) of recently-fired events
- `recordFired(id, firedAt)` — called internally after each successful callback invocation in `tick()`

### Registration Sites

- `JSRunner.getScheduler(nodeId)` → `register(nodeId, scheduler)` on creation
- `JSRunner.destroy(nodeId)` → `unregister(nodeId)` before dispose
- `BeatObject.create()` → register; `BeatObject.destroy()` → unregister

## TimelineRuler Component

Canvas-based Svelte 5 component, polls SchedulerRegistry at 30fps.

### Rendering

- **Window**: 4 bars starting from current bar
- **Grid**: Bar lines (zinc-600, 2px), beat lines (zinc-700, 1px)
- **Playhead**: White vertical line at current transport time
- **Markers**:
  - `beat` → triangles on subscribed beat positions (repeated per visible bar)
  - `schedule` → vertical dashed line at absolute time (unfired only)
  - `every` → diamonds at computed future occurrences within window
- **Flash**: Radial glow at marker position, fades over 300ms
- **Colors**: Per-node from 8-color palette via nodeId hash

### TransportPanel Integration

Wraps existing controls in `flex flex-col gap-1`, adds `<TimelineRuler />` as second row.

## Files

- `ui/src/lib/transport/SchedulerRegistry.ts` — new
- `ui/src/lib/transport/timeline-colors.ts` — new
- `ui/src/lib/transport/LookaheadClockScheduler.ts` — add introspection
- `ui/src/lib/js-runner/JSRunner.ts` — wire register/unregister
- `ui/src/lib/objects/v2/nodes/BeatObject.ts` — wire register/unregister
- `ui/src/lib/components/transport/TimelineRuler.svelte` — new
- `ui/src/lib/components/transport/TransportPanel.svelte` — layout change
