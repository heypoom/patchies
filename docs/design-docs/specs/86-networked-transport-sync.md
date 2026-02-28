# 86. Networked Transport Sync

Allow multiple Patchies instances in the same Trystero room to share a synchronized global transport: BPM, time signature, play/pause/stop state, and a common time origin — so visuals and audio trigger on the same beat across machines.

## Problem

When multiple people join the same Trystero room they can already share patch messages via `netsend`/`netrecv`. But each instance runs its own independent transport. There is no way to:

- Start everyone on the same beat at the same moment
- Keep BPM and time signature in sync when one peer changes them
- Recover a late-joining peer to the correct transport position

## Goals

1. **Opt-in sync** — default behavior is unchanged; sync activates only when explicitly enabled
2. **Single leader** — one peer owns the transport (the "leader"); others follow
3. **Late-join recovery** — a peer that joins mid-session catches up to the current position
4. **Drift correction** — followers continuously compensate for clock skew between machines
5. **Leader handoff** — if the leader disconnects, peers elect a new one automatically

## Architecture

### Reserved P2P Channel: `__transport`

Network transport sync uses `P2PManager.subscribeToChannel` / `sendToChannel` on the reserved channel name `__transport`. This is the same Trystero room the user is already in — no separate room needed.

The `TransportSyncManager` singleton owns this channel. It is separate from the user-facing `netsend`/`netrecv` nodes, which continue to work on arbitrary user-defined channels.

### Roles

| Role | Description |
|------|-------------|
| **Leader** | The peer who controls transport state. Broadcasts state changes and heartbeats. |
| **Follower** | Receives state from the leader and adjusts local transport to match. |

Role is determined by **lowest `selfId` lexicographically** among connected peers. On every peer join or leave, all peers re-evaluate the leader (no voting round-trip needed since `selfId` is deterministic).

The local peer always knows if it is the leader: `p2pManager.getMyPeerId() === computedLeaderId`.

### Message Protocol

All messages sent on `__transport` channel are plain JSON objects with a `type` field:

```typescript
type TransportSyncMessage =
  | { type: 'state'; payload: TransportStatePayload }     // leader → all followers
  | { type: 'heartbeat'; payload: HeartbeatPayload }      // leader → all followers (periodic)
  | { type: 'request-state' }                             // new follower → all (leader responds)
```

#### `state` — Full state broadcast

Sent when the leader's transport changes (play, pause, stop, BPM, time signature, seek).

```typescript
interface TransportStatePayload {
  playing: boolean;
  bpm: number;
  timeSignature: [number, number];
  originWallTime: number;   // performance.now() on the leader when transport started (ms)
  transportTime: number;    // transport time in seconds at the moment this message was sent
  leaderSendTime: number;   // performance.now() on the leader when this message was sent (ms)
}
```

#### `heartbeat` — Periodic drift correction

Sent by the leader every ~1 second while playing.

```typescript
interface HeartbeatPayload {
  transportTime: number;    // current transport seconds on leader
  leaderSendTime: number;   // performance.now() on leader (ms)
}
```

#### `request-state` — Late-join catchup

Sent by a new follower on room join. The leader responds with a `state` message.

### Follower Time Alignment

When a follower receives a `state` or `heartbeat` message it calculates the estimated current leader transport time:

```typescript
const networkLatency = (performance.now() - payload.leaderSendTime) / 2; // rough RTT/2
const estimatedLeaderTime = payload.transportTime + networkLatency / 1000;
const localTransportTime = transport.getTime();
const drift = estimatedLeaderTime - localTransportTime;
```

**Correction strategy:**

- `|drift| < 10ms` — ignore (within tolerance)
- `10ms ≤ |drift| < 500ms` — apply gradual rate adjustment (speed up/slow down slightly)
- `|drift| ≥ 500ms` — hard seek to `estimatedLeaderTime`

The gradual adjustment nudges the Tone.js transport BPM slightly (±2%) for up to 2 seconds to converge without an audible jump. This is the same technique used by NTP clients.

### Leader Sends on Transport Events

The leader subscribes to `PatchiesEventBus` transport events and broadcasts a `state` message on each:

| Event | Triggers |
|-------|---------|
| `play` | `state` with `playing: true` and fresh `originWallTime` |
| `pause` | `state` with `playing: false` |
| `stop` | `state` with `playing: false`, `transportTime: 0` |
| `bpm-change` | `state` with updated `bpm` |
| `time-signature-change` | `state` with updated `timeSignature` |
| `seek` | `state` with updated `transportTime` |

### Heartbeat

While playing, the leader sends a `heartbeat` every 1000ms (configurable). Followers use heartbeats for ongoing drift correction without needing a full state snapshot.

### Late-Join Catchup Flow

1. New peer joins room → `P2PManager.onPeerJoin` fires
2. New peer broadcasts `request-state` on `__transport`
3. Leader receives it → sends `state` message
4. New peer applies the state: applies BPM, time signature, seeks to `estimatedLeaderTime`, plays if `playing: true`

### Leader Re-election

When any peer joins or leaves, every peer independently recomputes:

```typescript
const allPeers = [p2pManager.getMyPeerId(), ...p2pManager.getPeerIds()].sort();
const leaderId = allPeers[0]; // lexicographically lowest
const isLeader = leaderId === p2pManager.getMyPeerId();
```

No round-trip or negotiation — all peers converge on the same leader instantly. The new leader immediately sends a `state` message so followers know it is active.

## UI

Network transport sync is opt-in, controlled from the transport panel.

### Transport Panel Changes

Add a **Network Sync** toggle alongside the existing DSP toggle:

```
┌──────────────────────────────────────────────────────────┐
│ ▶  ■   120 BPM   4/4   00:00:00   🔊 ─────  DSP  Sync  │
└──────────────────────────────────────────────────────────┘
```

- **Sync** button: toggles network transport sync on/off
- Inactive (grey): local transport, no sync
- Active (green): sync enabled
  - Leader: shows a crown icon `♛` or "Leader" badge
  - Follower: shows peer count and "Following" badge
  - Transport play/pause/stop/BPM/time-sig controls are **read-only** when following (same visual treatment as MIDI slave mode in spec 85)

When sync is enabled and no peers are in the room, the local peer becomes leader and broadcasts to future joiners. The button shows "Waiting for peers..." in this state.

### Tooltip

When hovering the Sync button while following:

> "Transport is controlled by the room leader. Change BPM or press play on the leader's machine."

## TransportSyncManager

New singleton: `src/lib/transport/TransportSyncManager.ts`

```typescript
class TransportSyncManager {
  private enabled = false;
  private isLeader = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeChannel: (() => void) | null = null;
  private unsubscribeEvents: (() => void) | null = null;

  enable(): void;   // start syncing — subscribe to channel + transport events
  disable(): void;  // stop syncing — unsubscribe, restore local control
  destroy(): void;  // cleanup on page unload

  private onPeerJoin(peerId: string): void;
  private onPeerLeave(peerId: string): void;
  private reelectLeader(): void;
  private onMessage(msg: TransportSyncMessage): void;
  private broadcastState(): void;
  private broadcastHeartbeat(): void;
  private applyState(payload: TransportStatePayload): void;
  private applyDriftCorrection(drift: number): void;
}

export const transportSyncManager = new TransportSyncManager();
```

`TransportSyncManager` does **not** import from any Svelte component. UI reads its state via a Svelte store:

```typescript
// src/stores/transport-sync.store.ts
export const transportSyncStore = $state({
  enabled: false,
  isLeader: false,
  peerCount: 0,
});
```

## Interaction with Transport Abstraction Layer

The existing transport (`DefaultTransport` or `ToneTransport`) is already the single source of truth for the clock. `TransportSyncManager` calls the same `Transport.play()`, `Transport.stop()`, `Transport.setBpm()`, `Transport.seek()` methods that the transport panel uses — no special hooks needed.

**No Tone.js upgrade required.** Unlike MIDI clock sync (spec 85) which must schedule `0xF8` pulses with AudioContext timestamps, network sync sends JSON over WebRTC data channels where ±25ms precision is acceptable. All operations (`play`, `setBpm`, `seek`, BPM nudge) are available on `DefaultTransport`. `TransportSyncManager` works against the generic transport interface and does not call `ensureToneUpgraded()`. If Tone.js is already loaded for another reason, it transparently operates on the Tone.js transport instead.

When the local instance is a follower, the `TransportSyncManager` sets a `following` flag that the transport panel reads to disable its controls.

## Relationship to MIDI Sync (Spec 85)

MIDI sync and network sync are mutually exclusive leadership models:

| MIDI slave active | Network sync active | Result |
|-------------------|---------------------|--------|
| No | No | Local transport |
| Yes | No | MIDI master drives transport |
| No | Yes | Network leader drives transport |
| Yes | Yes | **Not allowed** — UI prevents enabling both simultaneously; shows a warning toast |

## Precision Considerations

Network RTT between peers on the same LAN is typically 1–5ms; across the internet it can be 20–150ms. The RTT/2 estimate used for latency correction is imprecise but sufficient for **beat-level sync** (±25ms). This is the same order of magnitude as the existing visual scheduling precision.

For sub-beat sample-accurate sync (e.g., triggering audio samples simultaneously across machines), users should continue using the `{ audio: true }` lookahead scheduling on each machine independently, driven by the synchronized BPM and time origin.

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/lib/transport/TransportSyncManager.ts` | New — P2P sync logic |
| `src/stores/transport-sync.store.ts` | New — reactive UI state |
| `src/lib/components/TransportPanel.svelte` | Add Sync toggle; disable controls when following |
| `src/lib/p2p/P2PManager.ts` | Expose `getPeerIds()` method (if not already present) |
| `static/content/topics/transport-control.md` | Document the Sync button |
| `static/content/topics/network-p2p.md` | Note that `__transport` is a reserved channel name |

## Implementation Order

1. `TransportSyncManager` — enable/disable skeleton, channel subscription, message parsing
2. Leader path — broadcast `state` on transport events, periodic heartbeat
3. `request-state` / late-join catchup
4. Follower path — apply state, hard seek correction
5. Gradual drift correction (±2% BPM nudge)
6. Leader re-election on peer join/leave
7. `transport-sync.store.ts` + transport panel UI (toggle, badges, read-only controls)
8. MIDI slave conflict guard
9. Documentation updates

## Verification

### Basic Sync

1. Open Patchies in two browser tabs sharing the same `?room=` URL
2. Enable Sync in both — one becomes Leader, the other Follower
3. Press play on the leader — follower starts within ~50ms
4. Change BPM on leader to 90 — follower updates immediately
5. Pause on leader — follower pauses
6. Stop on leader — both reset to time 0
7. Follower transport controls are grayed out while following

### Late Join

1. Leader starts playing at bar 8 (several seconds in)
2. Open a new tab with the same room URL and enable Sync
3. New peer should start from approximately bar 8, not bar 0

### Leader Handoff

1. Start with two peers; peer A is leader
2. Close peer A's tab
3. Peer B should become leader; its transport controls become active

### Conflict Guard

1. Enable MIDI slave mode (spec 85)
2. Attempt to enable Network Sync
3. A warning toast should appear: "Cannot use Network Sync while MIDI slave is active"
