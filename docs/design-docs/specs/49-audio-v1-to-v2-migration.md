# Audio V1 to V2 Migration Guide

## Overview

Migrate V1 audio nodes (defined in `AudioSystem.ts`) to V2 (self-contained classes in `v2/nodes/`).

**Core Principle**: Node name (e.g., `'gain~'`) appears **only once** in the codebase: in the V2 class's `static type` property.

## Key Architectural Points

1. **Optional Methods**: Only implement `create()`, `send()`, `getAudioParam()` if needed. AudioService provides defaults.
2. **Node Groups**: `'sources'` (output only), `'processors'` (input+output), `'destinations'` (input only)
3. **🚨 CRITICAL - No Hardcoding Node Names in AudioService**: NEVER check node type with string comparisons like `if (nodeType === 'sampler~')` inside `AudioService`. This breaks encapsulation and causes bugs. Instead: Let individual nodes implement `connect()` or `connectFrom()` methods to handle their own special logic. The node type check belongs in the node class, NOT in the generic service.
4. **Dual updateEdges()**: Both `AudioSystem.updateEdges()` (V1) and `AudioService.updateEdges()` (V2) run to handle both systems.

## Completed Migrations (27 nodes)

- ✅ Phase 1: `fft~`, `compressor~`, `waveshaper~`, `convolver~`
- ✅ Phase 2: `mic~`, `merge~`, `split~`
- ✅ Phase 3 Part 1: `sampler~`, `soundfile~`
- ✅ Phase 3 Part 2: `expr~`, `dsp~` (AudioWorklet processors with GainNode wrapper)
- ✅ Phase 4: `tone~`, `elem~` (Manager-based nodes with async library code execution)
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

## Phase 3 Part 2: expr~ Lessons Learned

### Problem: Nodes Missing from nodesById During Patch Loading

**Issue**: When loading patches, `expr~` nodes weren't connecting properly. Logs showed:

```txt
v2#connectByEdge: skip expr~-125 -> object-126: missing node {sourceNode: undefined, targetNode: DacNode}
```

**Root Cause**: `AudioService.createNode()` was adding nodes to `nodesById` AFTER the async `create()` method completed. For nodes with async initialization (AudioWorklets), this meant nodes weren't available for connections.

**Fix**: Move `nodesById.set()` to run IMMEDIATELY after construction, before `await node.create()`:

```typescript
async createNode(nodeId, nodeType, params) {
  const node = new NodeClass(nodeId, audioContext);
  this.nodesById.set(node.nodeId, node);  // ✅ Add immediately
  await node.create?.(params);             // Then initialize async
  return node;
}
```

### Pattern: Wrapper Node for Async AudioWorklets

For processor nodes using AudioWorklet (which load asynchronously):

1. **Constructor**: Create a `GainNode` as `audioNode` (immediately connectable)
2. **create()**: Load worklet async, create `workletNode`, connect it to gain
3. **connectFrom()**: Route incoming audio to worklet input
4. **Signal flow**: `source → workletNode (processing) → audioNode (output)`

```typescript
export class ExprNode implements AudioNodeV2 {
  audioNode: GainNode;                    // Wrapper for output
  private workletNode: AudioWorkletNode | null = null;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.audioNode = audioContext.createGain();  // Immediate
  }

  async create(params: unknown[]): Promise<void> {
    await ExprNode.ensureModule(this.audioContext);
    this.workletNode = new AudioWorkletNode(...);
    this.workletNode.connect(this.audioNode);    // Chain to output
  }

  connectFrom(source: AudioNodeV2): void {
    source.audioNode.connect(this.workletNode);  // Route to processor
  }
}
```

**Key insight**: The wrapper pattern ensures nodes are immediately connectable even when internal processing takes time to initialize.

## Phase 4: tone~ and elem~ Lessons Learned

### Pattern: Manager-to-Node Migration

Successfully migrated `ToneManager` and `ElementaryAudioManager` to V2 node classes.

**Key Patterns**:

1. **Dual-Gain-Node**: `audioNode` (output) + `inputNode` (for external audio input)
2. **Target-Side Connection**: Implement `connectFrom()` to route incoming audio to `inputNode`
3. **Dynamic Ports**: Expose `onSetPortCount: OnSetPortCount = () => {}` callback for UI
4. **Async Loading**: Lazy-load libraries (`import('tone')`, `import('@elemaudio/core')`)
5. **Message Integration**: Use `MessageContext` for `send()`/`recv()`
6. **Cleanup**: Disconnect audio nodes, destroy message context, library-specific cleanup

**elem~ Specifics**: Uses `JSRunner` for code preprocessing and creates `AudioWorkletNode` via `WebRenderer.initialize()`

**Migration Checklist**:

- Create V2 node with `connectFrom()`, `onSetPortCount`, `MessageContext`
- Update Svelte: Use `AudioService.getNodeById()`, cast type, set callback
- Remove V1: Delete manager method/import/case from `AudioSystem.ts`, interface from `audio-node-types.ts`
- Register in `v2/nodes/index.ts`
- Delete manager file

## Remaining Work (2 nodes)

### Phase 5 (Manager-Based - Delete These to Remove AudioSystem)

- [ ] `csound~` - CsoundManager
- [ ] `chuck` - ChuckManager

**Pattern**: Follow the tone~/elem~ pattern documented above.

**Reference Implementation** (`tone~` as example):

```typescript
export class ToneNode implements AudioNodeV2 {
  static type = "tone~";
  audioNode: GainNode;

  private inputNode: GainNode;
  private messageContext: MessageContext;
  public onSetPortCount: OnSetPortCount = () => {};

  constructor(nodeId: string, audioContext: AudioContext) {
    this.audioNode = audioContext.createGain();
    this.inputNode = audioContext.createGain();
    this.messageContext = new MessageContext(nodeId);
  }

  async create(params: unknown[]): Promise<void> {
    const [, code] = params as [unknown, string];
    if (code) await this.setCode(code);
  }

  connectFrom(source: AudioNodeV2): void {
    source.audioNode.connect(this.inputNode);
  }

  destroy(): void {
    this.cleanup();
    this.messageContext.destroy();
    this.audioNode.disconnect();
    this.inputNode.disconnect();
  }
}
```

## Final Goal

Once all 30 nodes migrated: **Delete AudioSystem entirely**. All functionality moves to AudioService + manager-based nodes.
