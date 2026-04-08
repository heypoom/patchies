# 84. Transport Sync for Musical Objects

Sync Strudel, Orca, and other musical objects to the master transport so everything plays at the same tempo and responds to play/pause/stop.

## Problem

Several musical objects run their own independent clocks:

| Object   | Own Clock                                          | Synced to Transport? |
|----------|----------------------------------------------------|----------------------|
| Strudel  | Superdough scheduler + `AudioContext.currentTime`  | No                   |
| Orca     | Web Worker `setInterval` at `60000 / bpm / 4`      | No                   |
| ChucK    | ChucK's `::now` timing system                      | No                   |
| Csound   | Csound's `sr`/`ksmps` timing                       | No                   |
| Bytebeat | Sample counter `t` at fixed sample rate            | No                   |
| Metro    | `setInterval` in ms                                | No                   |

Visual nodes (GLSL, Hydra, P5, Canvas, Three, Textmode) and `tone~` already sync to the master transport via spec 78. Audio nodes using the `clock` API (js, worker, etc.) sync via spec 81. But Strudel and Orca — the two most important standalone musical sequencers — run completely independently, drifting apart over time.

## Scope

### Tier 1: Full Sync (BPM + Play/Pause/Stop)

**Strudel**: Sync CPM to transport BPM, respond to play/pause/stop.

**Orca**: Sync BPM to transport BPM, respond to play/pause/stop.

### Tier 2: Play/Pause/Stop Only (No BPM)

These objects have no tempo concept but should still respond to transport play/pause/stop for a unified experience.

**Bytebeat**: Sample counter `t` — no BPM to sync. But play/pause/stop should follow transport:

- Transport play → unmute (resume `t` counting)
- Transport pause → freeze `t` (mute output)
- Transport stop → reset `t` to 0 and mute

**ChucK**: Has its own `::now` timing system. BPM sync would require deep VM integration, but play/pause/stop can be forwarded via the existing message interface.

**Csound**: Has its own `sr`/`ksmps` timing. Same approach — forward play/pause/stop only.

### Out of Scope

**Metro**: Already takes interval in ms, not beats. Could accept beat-relative intervals in the future, but that's a separate feature.

## Design

### Transport Subscription Pattern

Both Strudel and Orca need to react to transport changes. Rather than polling, they subscribe to `transportStore` for BPM/time-signature changes and listen for play/pause/stop via the `Transport` singleton.

### Strudel

**BPM → CPM mapping**: `CPM = BPM / beatsPerBar`. In 4/4 at 120 BPM, one Strudel cycle = one bar = 30 CPM. This is the standard Strudel convention (1 cycle = 1 bar).

**Integration point**: `StrudelEditor.svelte` line 107 — `getTime` already uses `audioService.getAudioContext().currentTime`. The missing piece is tempo sync.

#### Changes to `StrudelEditor.svelte`

1. Import `transportStore` and `Transport`
2. Subscribe to `transportStore` for BPM changes
3. When BPM changes, call `editor.setCps(bpm / beatsPerBar / 60)` (CPM→CPS conversion: `CPS = CPM / 60 = BPM / beatsPerBar / 60`)
4. On transport play → `editor.evaluate()` (start playing if code is loaded)
5. On transport stop → `editor.stop()`
6. On transport pause → `editor.stop()` (Strudel has no pause — stop is the closest)

#### Opt-out

Add a `syncTransport` prop (default `true`) to `StrudelEditor`. When false, Strudel ignores transport changes. This lets users who want independent Strudel timing opt out.

Store this in node data so it persists. Show a toggle in the Strudel node's settings.

### Orca

**BPM mapping**: Direct 1:1. Orca's BPM = transport BPM.

#### Changes to `OrcaNode.svelte`

1. Subscribe to `transportStore` for BPM changes
2. When BPM changes, call `clock.setSpeed(bpm, bpm)`
3. On transport play → `clock.play()` (if not already playing)
4. On transport stop → `clock.stop()`
5. On transport pause → `clock.stop()`
6. Remove Orca's independent BPM localStorage persistence (`orca-bpm` key) — use transport BPM instead

#### Opt-out

Same pattern: `syncTransport` toggle in node data (default `true`). When synced, hide the BPM controls in Orca's settings panel since they'd conflict.

### Bytebeat

Bytebeat has no BPM concept — it's a sample counter `t` incrementing at a fixed sample rate. But it should respond to transport play/pause/stop.

**Current behavior**: `BytebeatNode` has its own `play()`, `pause()`, `stop()` methods. Play/pause is gain-based (gain 1 vs 0), and the worklet keeps running regardless. Stop also calls `reset()` to zero out `t`.

**Integration point**: `BytebeatNode.ts` — an `AudioNodeV2` class, not a Svelte component. Needs a different subscription mechanism than the Svelte store.

#### Changes to `BytebeatNode.ts`

1. Accept a `syncTransport` flag (default `true`) in `create()` params or node data
2. Subscribe to `transportStore` changes (using `transportStore.subscribe()` directly — works outside Svelte components)
3. On transport play → call `this.play()`
4. On transport pause → call `this.pause()` (freezes gain to 0, worklet keeps `t` position)
5. On transport stop → call `this.stop()` (resets `t` to 0)
6. Unsubscribe in `destroy()`

### ChucK / Csound

Same pattern as Bytebeat — subscribe to `transportStore.isPlaying` and forward play/pause/stop. No BPM sync.

These are Svelte components, so they can use `$effect` to react to store changes.

### Transport Events

Currently there's no event bus event for transport state changes. Nodes subscribe to `transportStore` (Svelte store) directly. This works for Svelte components (Strudel and Orca nodes are `.svelte` files), so no new event bus events are needed. For `AudioNodeV2` classes like `BytebeatNode`, call `transportStore.subscribe()` directly.

For play/pause/stop, subscribe to `transportStore.isPlaying` changes.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/components/StrudelEditor.svelte` | Subscribe to transportStore, sync CPS on BPM change, respond to play/stop |
| `src/lib/components/nodes/StrudelNode.svelte` | Add `syncTransport` toggle to settings UI and node data |
| `src/lib/components/nodes/OrcaNode.svelte` | Subscribe to transportStore, sync BPM, respond to play/stop, add `syncTransport` toggle |
| `src/lib/audio/v2/nodes/BytebeatNode.ts` | Subscribe to transportStore.isPlaying, forward play/pause/stop, unsubscribe in destroy() |
| `src/lib/components/nodes/ChuckNode.svelte` | Subscribe to transportStore.isPlaying, forward play/pause/stop |
| `src/lib/components/nodes/CsoundNode.svelte` | Subscribe to transportStore.isPlaying, forward play/pause/stop |
| `src/lib/nodes/defaultNodeData.ts` | Add `syncTransport: true` default for strudel, orca, bytebeat, chuck, csound nodes |

## Implementation Order

1. Strudel transport sync (BPM + play/stop)
2. Strudel opt-out toggle
3. Orca transport sync (BPM + play/stop)
4. Orca opt-out toggle
5. Bytebeat transport sync (play/pause/stop only)
6. ChucK transport sync (play/pause/stop only)
7. Csound transport sync (play/pause/stop only)

## Verification

### Manual Testing

1. Set transport BPM to 140, play — Strudel pattern plays at 140 BPM feel (35 CPM in 4/4)
2. Change transport BPM while playing — Strudel follows immediately
3. Stop transport — Strudel stops
4. Set transport BPM to 90 — Orca follows
5. Play/stop transport — Orca follows
6. Toggle `syncTransport` off — node ignores transport, uses own tempo
7. Change time signature to 3/4 — Strudel CPM updates accordingly
8. Play transport — Bytebeat starts playing
9. Pause transport — Bytebeat pauses (t frozen)
10. Stop transport — Bytebeat stops and resets t to 0
11. Play transport — ChucK/Csound start playing
12. Stop transport — ChucK/Csound stop
