# 85. MIDI Clock Sync

Send MIDI clock to external devices (master) or lock the transport to an incoming MIDI clock (slave) via a `midi-clock~` node.

## Problem

Patchies has no way to synchronize with hardware synthesizers, drum machines, or DAWs via MIDI clock. The two common use cases are:

- **Master**: Patchies drives external gear — Patchies is the tempo source
- **Slave**: External gear drives Patchies — e.g., a drum machine sets the tempo and Patchies follows

MIDI clock is a System Realtime protocol: 24 `0xF8` pulse messages per quarter note, plus `0xFA` (Start), `0xFB` (Continue), `0xFC` (Stop).

## Architecture Decision: Tone.js Only

MIDI clock sync requires Tone.js. The `midi-clock~` node triggers `Transport.ensureToneUpgraded()` on mount, the same upgrade path used by `tone~` and audio nodes. The 500KB Tone.js cost is acceptable for anyone needing MIDI clock.

DefaultTransport has no MIDI clock support — the upgrade happens automatically and transparently when the node is mounted.

## Node: `midi-clock~`

A Svelte component node (same pattern as `MIDIInputNode`, `MIDIOutputNode`) with no audio inlets/outlets. It operates entirely on the control path.

```
┌─────────────────────────┐
│  🕐  midi-clock~        │
│                         │
│  Mode: [master ▾]       │
│  Device: [IAC Bus 1 ▾]  │
│  Status: ● sending      │
└─────────────────────────┘
```

### Node Data

```typescript
interface MidiClockNodeData {
  mode: 'master' | 'slave' | 'off';
  deviceId: string;       // MIDI output (master) or input (slave) device ID
  bpmSmoothing: number;   // Slave: pulse window for BPM averaging (default 24)
  driftThreshold: number; // Slave: ticks of drift before correction (default 4)
}
```

### Modes

| Mode | Transport role | MIDI direction |
|------|---------------|----------------|
| `master` | Patchies is tempo source | Send clock out |
| `slave` | External device is tempo source | Receive clock in |
| `off` | No sync | — |

## Master Mode

### What it sends

| Transport event | MIDI message |
|----------------|-------------|
| play() | `0xFA` (Start) |
| pause() | `0xFC` (Stop) — MIDI has no pause |
| stop() | `0xFC` (Stop) |
| continue after pause | `0xFB` (Continue) |
| every 1/24 beat | `0xF8` (Timing Clock) |

### Clock Pulse Scheduling

Use `LookaheadClockScheduler` in audio mode (`{ audio: true }`). The lookahead fires callbacks ~100ms early with a precise AudioContext timestamp — convert to a Web MIDI `DOMHighResTimeStamp` for scheduled delivery:

```typescript
const midiTime = performance.now() + (audioContextTime - audioContext.currentTime) * 1000;
midiOutput.send([0xF8], midiTime);
```

Schedule a repeating pulse every `1/24` of a beat:

```typescript
scheduler.every('0:0:2', ({ time }) => {  // 1/24 beat = 1 sixteenth / 3
  const midiTime = audioTimeToMidiTime(time);
  midiOutput.send([0xF8], midiTime);
}, { audio: true });
```

> `0:0:2` in Tone.js notation = 2 subdivisions at PPQ=192, which is 192/24 = 8 ticks = one MIDI clock pulse.

BPM changes propagate automatically since the scheduler recalculates intervals on BPM change (existing behavior from spec 80).

### Transport Event Hooks

Subscribe to `PatchiesEventBus` transport events (or wrap `Transport.play/stop/pause`) to send Start/Stop/Continue at the correct AudioContext time:

```typescript
// On play: send Start immediately (scheduled for "now")
midiOutput.send([0xFA], performance.now());

// On stop: send Stop
midiOutput.send([0xFC], performance.now());
```

## Slave Mode

### Receiving Clock

webmidi.js v3 exposes System Realtime messages as named events on `Input`:

```typescript
input.addListener('clock', onClockPulse);
input.addListener('start', onStart);
input.addListener('continue', onContinue);
input.addListener('stop', onStop);
```

No raw Web MIDI API access needed — webmidi.js handles the filtering.

`MIDISystem` gains a `addClockListener(deviceId, listener)` / `removeClockListener` pair that wraps the webmidi.js input events, following the existing `startListening` pattern.

### BPM Estimation

Maintain a ring buffer of the last N pulse timestamps (default N=24, i.e. one beat's worth of history):

```typescript
const intervals = pulseTimestamps.slice(-N).map((t, i, a) => i > 0 ? t - a[i-1] : 0).slice(1);
const avgInterval_ms = intervals.reduce((a, b) => a + b) / intervals.length;
const estimatedBpm = 60_000 / (avgInterval_ms * 24);
```

Feed into Tone.js:

```typescript
Tone.getTransport().bpm.value = estimatedBpm;
```

The averaging window trades responsiveness for stability. 24 pulses (~500ms at 120 BPM) is a sensible default; expose `bpmSmoothing` in the node UI for users who want tighter tracking.

### Position / Drift Correction

Each `0xF8` pulse = 8 ticks at PPQ=192 (192 / 24 = 8). Maintain a `pulseCount` that increments on each pulse and resets on Start.

Every 24 pulses (= 1 beat), compare expected vs actual transport position:

```typescript
const expectedTicks = pulseCount * 8;
const actualTicks = Tone.getTransport().ticks;

if (Math.abs(actualTicks - expectedTicks) > driftThreshold) {
  Tone.getTransport().ticks = expectedTicks;
}
```

The default `driftThreshold` of 4 ticks = half a MIDI clock pulse interval, which avoids micro-corrections while still catching real drift.

### Start / Continue / Stop

```typescript
onStart:    Transport.stop(); Transport.play();   // reset position, then play
onContinue: Transport.play();                     // resume without reset
onStop:     Transport.pause();                    // pause (preserve position for Continue)
```

### Slave UI Affordances

When slave mode is active:

- Disable transport play/pause/stop buttons in the transport panel (grey them out with a tooltip: "Controlled by MIDI clock")
- Show current estimated BPM in the node (read-only) alongside the device selector
- Show a pulse activity indicator (small flash on each beat, like a beat LED on hardware)

## MIDISystem Changes

Add two methods:

```typescript
addClockListener(deviceId: string, listener: MidiClockListener): void;
removeClockListener(deviceId: string, listener: MidiClockListener): void;

interface MidiClockListener {
  onClock(timestamp: number): void;
  onStart(): void;
  onContinue(): void;
  onStop(): void;
}
```

These wrap webmidi.js input events and handle device lookup + listener registration, matching the existing `startListening` / `stopListening` pattern.

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/lib/components/nodes/MidiClockNode.svelte` | New node component |
| `src/lib/canvas/MIDISystem.ts` | Add `addClockListener` / `removeClockListener` |
| `src/lib/nodes/node-types.ts` | Register `midi-clock~` node type |
| `src/lib/nodes/defaultNodeData.ts` | Add defaults for `midi-clock~` |
| `src/lib/extensions/object-packs.ts` | Add to MIDI pack |
| `src/lib/ai/object-descriptions-types.ts` | Add to `OBJECT_TYPE_LIST` |
| `src/lib/ai/object-prompts/midi-clock~.ts` | AI prompt file |
| `src/lib/ai/object-prompts/index.ts` | Register prompt |
| `static/content/objects/midi-clock~.md` | Object documentation |
| `src/lib/components/TransportPanel.svelte` | Disable play/stop when slave active |

## Implementation Order

1. `MIDISystem.addClockListener` / `removeClockListener`
2. `MidiClockNode.svelte` — master mode only (simpler, no transport takeover)
3. Master: pulse scheduling via LookaheadClockScheduler in audio mode
4. Master: Start/Stop/Continue messages on transport events
5. Slave: BPM estimation from pulse ring buffer
6. Slave: drift correction on beat boundary
7. Slave: Start/Continue/Stop handlers
8. Slave: disable transport UI when active
9. Node registration, docs, AI prompts

## Verification

### Master

1. Connect Patchies MIDI output to a DAW or hardware device
2. Set transport BPM to 120, press play — external device syncs to 120 BPM
3. Change BPM to 90 — external device follows within 1–2 beats
4. Press stop — external device stops
5. Press play again — external device receives Start and restarts from beat 1

### Slave

1. Connect a MIDI clock source (DAW or hardware) to Patchies MIDI input
2. Set external device to 140 BPM and press play — Patchies transport follows at ~140 BPM
3. Patchies transport play/stop buttons are greyed out
4. Change external BPM to 100 — Patchies follows within the smoothing window (~500ms)
5. Stop external device — Patchies transport pauses
6. Press Continue on external device — Patchies resumes from same position
7. Press Start on external device — Patchies resets to beat 0 and plays
