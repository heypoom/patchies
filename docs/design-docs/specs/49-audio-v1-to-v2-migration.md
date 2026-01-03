# Audio V1 to V2 Migration Guide

## Overview

Migrate V1 audio nodes (defined in `AudioSystem.ts`) to V2 (self-contained classes in `v2/nodes/`).

**Core Principle**: Node name (e.g., `'gain~'`) appears **only once** in the codebase: in the V2 class's `static type` property.

## Key Architectural Points

1. **Optional Methods**: Only implement `create()`, `send()`, `getAudioParam()` if needed. AudioService provides defaults.
2. **Node Groups**: `'sources'` (output only), `'processors'` (input+output), `'destinations'` (input only)
3. **🚨 CRITICAL - No Hardcoding Node Names in AudioService**: NEVER check node type with string comparisons like `if (nodeType === 'sampler~')` inside `AudioService`. This breaks encapsulation and causes bugs. Instead: Let individual nodes implement `connect()` or `connectFrom()` methods to handle their own special logic. The node type check belongs in the node class, NOT in the generic service.
4. **Dual updateEdges()**: Both `AudioSystem.updateEdges()` (V1) and `AudioService.updateEdges()` (V2) run to handle both systems.

## Completed Migrations (23 nodes)

- ✅ Phase 1: `fft~`, `compressor~`, `waveshaper~`, `convolver~`
- ✅ Phase 2: `mic~`, `merge~`, `split~`
- ✅ Phase 3 Part 1: `sampler~`
- ✅ Simple nodes: `osc~`, `gain~`, `dac~`, `sig~`, `+~`, `pan~`, `delay~`, `lowpass~`–`peaking~`

## V2 Node Template (Minimal)

```typescript
export class MyNode implements AudioNodeV2 {
  static type = "mynode~";
  static group: AudioNodeGroup = "processors";
  static description = "...";
  static inlets: ObjectInlet[] = [
    { name: "in", type: "signal" },
    { name: "param", type: "float", isAudioParam: true, defaultValue: 0 },
  ];
  static outlets: ObjectOutlet[] = [{ name: "out", type: "signal" }];

  readonly nodeId: string;
  readonly audioNode: MyAudioNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createMyNode();
  }

  create(params: unknown[]): void {
    const [, paramValue] = params as [unknown, number];
    this.audioNode.param.value = paramValue ?? 0;
  }
}
```

**Register in `v2/nodes/index.ts`**:

```typescript
import { MyNode } from "./MyNode";
// In registerAudioNodes():
AudioRegistry.getInstance().register(MyNode);
```

**Remove ALL V1 references**:

- Delete from `AudioSystem.ts` (method + switch cases in `createAudioObject()`, `getAudioParam()`, `send()`)
- Delete from `audio-node-types.ts` (interface + union type)
- Delete from `object-definitions.ts`
- Delete from `audio-node-group.ts` V1 fallback (if present)

## Special Patterns

### Source Nodes with Special Cleanup

Implement `destroy()` only for sources that need it:

```typescript
destroy(): void {
        this.audioNode.stop();  // OscillatorNode, etc.
    this.audioNode.disconnect();
}
```

### Target-Side Custom Connection (e.g., sampler~)

Implement `connectFrom()` if the node receives audio with special routing:

```typescript
connectFrom(source: AudioNodeV2): void {
  source.audioNode.connect(this.recordingDestination);  // Custom input routing
}
```

### Source-Side Custom Connection (e.g., split~)

Implement `connect()` if the node outputs to specific channels:

```typescript
connect(target: AudioNodeV2, paramName?: string, sourceHandle?: string): void {
  const index = handleToPortIndex(sourceHandle);
  this.audioNode.connect(target.audioNode, index, 0);
}
```

## Phase 3: sampler~ Lessons Learned

### Problem 1: Node Group

**Issue**: Marked as `'sources'` which prevented connections TO it for recording.

**Fix**: Change to `'processors'` - it receives audio for recording, so it's a processor.

**Lesson**: Groups reflect the primary graph interface, not internal capabilities.

### Problem 2: Target-Side Connection Logic

**Issue**: `AudioService.connectByEdge()` only called `sourceNode.connect()`, not target logic.

**Fix**: Added `connectFrom()` method to `AudioNodeV2` interface for target-side custom routing.

**Logic**:

```typescript
if (sourceNode.connect) {
  sourceNode.connect(targetNode, paramName, sourceHandle, targetHandle);
} else if (targetNode.connectFrom) {
  targetNode.connectFrom(sourceNode, paramName, sourceHandle, targetHandle);
} else {
  this.defaultConnect(sourceNode, targetNode, paramName);
}
```

### Problem 3: MediaStreamAudioDestinationNode Has No Outputs

**Issue**: Tried to chain `recordingDestination.connect(audioNode)` for monitoring.

**Error**: `"output index (0) exceeds number of outputs (0)"`

**Fix**: Keep paths separate:

- Recording: source → `recordingDestination` (for MediaRecorder)
- Playback: `audioNode` (for output)

### Problem 4: Naming

**Issue**: `destinationNode` was ambiguous (audio destination vs. recording destination?).

**Fix**: Rename to `recordingDestination` - exactly describes its purpose.

### Problem 5: No Hardcoding Node Names in AudioService

**THE PITFALL**: We repeatedly tried to fix issues by checking node types in `AudioService`:

```typescript
// ❌ WRONG - NEVER DO THIS
if (targetType === "sampler~" && !paramName) {
  source.audioNode.connect(samplerNode.recordingDestination);
}
```

**Why**: Breaks encapsulation, doesn't scale, couples service to specific nodes.

**The Right Way**: Let nodes encapsulate their own logic via `connectFrom()`:

```typescript
// ✅ CORRECT - Node handles itself
connectFrom(source: AudioNodeV2): void {
  source.audioNode.connect(this.recordingDestination);
}
```

**Rule**: If adding `if (nodeType === 'xyz~')` to `AudioService`, add a method to the node class instead.

## Remaining Work (7 nodes)

### Phase 3 (Simple Complex)

- [ ] `soundfile~` - Audio file loading (MediaElementAudioSourceNode)

### Phase 4 (Manager-Based - Delete These to Remove AudioSystem)

- [ ] `expr~` - ExpressionProcessor
- [ ] `dsp~` - DspProcessor
- [ ] `tone~` - ToneManager
- [ ] `elem~` - ElementaryAudioManager
- [ ] `csound~` - CsoundManager
- [ ] `chuck` - ChuckManager

**Pattern**: Move manager logic into node class, delete manager singleton.

```typescript
export class ToneNode implements AudioNodeV2 {
  static type = "tone~";
  private synth: Tone.Synth | null = null; // Move from ToneManager

  send(key: string, msg: unknown): void {
    if (key === "code" && typeof msg === "string") {
      this.initTone(msg); // Move from ToneManager.init()
    }
  }

  destroy(): void {
    this.synth?.dispose(); // Move from ToneManager.cleanup()
    this.audioNode.disconnect();
  }
}
```

## Final Goal

Once all 30 nodes migrated: **Delete AudioSystem entirely**. All functionality moves to AudioService + manager-based nodes.
