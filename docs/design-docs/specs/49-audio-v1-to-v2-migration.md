# Audio V1 to V2 Migration Guide

## Overview

This document outlines the process for migrating V1 audio nodes to the V2 architecture, with the goal of eventually automating this process.

**Core Principle**: The node name (e.g., `'gain~'`) should be mentioned **only once** in the codebase: in the V2 node class's `static name` property. All V1 references must be removed during migration.

## Key Architectural Improvements

The V2 system includes several improvements that make migration cleaner:

1. **Automatic Group Detection**: `audio-node-group.ts` now checks the V2 registry first, reading the `static group` property directly from node classes. No manual updates needed for new V2 nodes.

2. **Registry-Based Lookup**: `AudioService.getNodeGroup()` provides dynamic node group lookup, eliminating hardcoded type mappings.

3. **Graceful Fallback**: All migration points (group detection, node creation, validation) check V2 first, then fall back to V1. This enables gradual migration without breaking existing functionality.

4. **Optional Methods**: Methods like `create()`, `send()`, and `getAudioParam()` are now optional. Nodes only implement what they need:

   - Nodes with no parameters don't need `create()`
   - Nodes with no messages don't need `send()`
   - Nodes with no audio parameters don't need `getAudioParam()`
   - AudioService provides safe optional chaining with `?.` operator

5. **Optional destroy()**: AudioService provides default cleanup (disconnect), so processor nodes don't need custom `destroy()` methods - only sources with special cleanup (e.g., oscillators needing `.stop()`).

6. **Type Safety**: Changed from restrictive V1 types (`V1PatchAudioType`) to `string` in function signatures, allowing both V1 and V2 nodes without type conflicts.

7. **No Hardcoding Node Names in AudioService**: Special node behavior is handled generically via the `group` property. Destination nodes automatically connect to `outGain` during `updateEdges()` without hardcoded node names.

8. **Dual updateEdges() Calls**: Both `AudioSystem.updateEdges()` (V1) and `AudioService.updateEdges()` (V2) are called from `FlowCanvasInner.svelte` to handle both V1 and V2 nodes correctly.

## Completed Migrations

- [x] `osc~` - Oscillator node (source, has destroy)
- [x] `gain~` - Gain/volume control node (processor, no destroy needed)
- [x] `dac~` - Digital-to-analog converter (destination, auto-connects to speakers)
- [x] `sig~` - Constant signal source (source, has destroy)
- [x] `+~` - Signal addition (processor, no destroy needed)
- [x] `pan~` - Stereo panning (processor, no destroy needed)
- [x] `delay~` - Time-based delay (processor, no destroy needed)

## Migration Pattern

### V1 Structure (AudioSystem.ts)

V1 nodes are defined as methods in the AudioSystem class:

```typescript
createGain(nodeId: string, params: unknown[]) {
    const [, gainValue] = params as [unknown, number];

    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = gainValue;

    this.nodesById.set(nodeId, { type: 'gain~', node: gainNode });
}
```

### V2 Structure (Separate class files)

V2 nodes are self-contained classes implementing the `AudioNodeV2` interface:

```typescript
export class GainNodeV2 implements AudioNodeV2 {
  static name = "gain~";
  static group: AudioNodeGroup = "processors";
  static description = "Controls audio volume/amplitude";

  static inlets: ObjectInlet[] = [
    /* ... */
  ];
  static outlets: ObjectOutlet[] = [
    /* ... */
  ];

  readonly nodeId: string;
  readonly audioNode: GainNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    /* ... */
  }
  create(params: unknown[]): void {
    /* ... */
  }
  getAudioParam(name: string): AudioParam | null {
    /* ... */
  }
  send(key: string, message: unknown): void {
    /* ... */
  }
  destroy(): void {
    /* ... */
  }
}
```

## Simplified Migration Steps (TL;DR)

**Modern V2 nodes are MUCH simpler:**

```typescript
export class LowpassNode implements AudioNodeV2 {
  static name = "lowpass~";
  static group: AudioNodeGroup = "processors";
  static description = "Low-pass filter";

  static inlets: ObjectInlet[] = [
    { name: "in", type: "signal" },
    {
      name: "frequency",
      type: "float",
      isAudioParam: true,
      defaultValue: 1000,
    },
    { name: "Q", type: "float", isAudioParam: true, defaultValue: 1 },
  ];

  static outlets: ObjectOutlet[] = [{ name: "out", type: "signal" }];

  readonly nodeId: string;
  readonly audioNode: BiquadFilterNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createBiquadFilter();
    this.audioNode.type = "lowpass";
  }

  create(params: unknown[]): void {
    const [, frequency, Q] = params as [unknown, number, number];
    this.audioNode.frequency.value = frequency ?? 1000;
    this.audioNode.Q.value = Q ?? 1;
  }

  // No getAudioParam() or send() needed! AudioService provides defaults.
}
```

That's it! Register in `index.ts` and you're done. 🎉

## Detailed Migration Steps

### 1. Create Node File

Create a new file in `ui/src/lib/audio/v2/nodes/[NodeName].ts`

**Naming Convention:**

- Prefix with `Patch` if the name conflicts with Web Audio API types (e.g., `GainNodeV2` vs `GainNode`)
- Use the same name as the V1 node without prefix if no conflict (e.g., `OscNode`)

### 2. Implement Static Properties

```typescript
static name = 'node~';           // The node type identifier (e.g., 'gain~', 'osc~')
static group: AudioNodeGroup;    // 'sources' | 'processors' | 'destinations'
static description = 'Brief description';
```

### 3. Define Inlets

Map V1 parameters to inlet definitions:

```typescript
static inlets: ObjectInlet[] = [
    {
        name: 'in',                    // First inlet is typically audio input (for processors)
        type: 'signal',
        description: 'Audio signal input'
    },
    {
        name: 'paramName',            // Additional inlets for parameters
        type: 'float',                // 'float', 'int', 'string', 'signal', etc.
        description: 'Parameter description',
        defaultValue: 1.0,
        isAudioParam: true,           // If it maps to an AudioParam
        maxPrecision: 3,              // For display purposes
        options: ['opt1', 'opt2'],    // For enum parameters (optional)
        validator: (value) => boolean, // Custom validation (optional)
        formatter: (value) => string   // Custom formatting (optional)
    }
];
```

### 4. Define Outlets

```typescript
static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Audio output' }
];
```

### 5. Implement Constructor

```typescript
constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createGain(); // Or appropriate Web Audio node
}
```

**Note for Destination Nodes**: No special connection logic needed in constructor - `AudioService.updateEdges()` automatically connects destination nodes to `outGain` based on the `group` property.

### 6. Implement create() Method (Optional)

Only implement if the node has parameters to initialize:

```typescript
create(params: unknown[]): void {
    // V1: const [, paramValue] = params as [unknown, number];
    // V2: Same destructuring pattern
    const [, paramValue] = params as [unknown, number];

    // Set initial values
    this.audioNode.gain.value = paramValue ?? defaultValue;

    // Call start() for source nodes (e.g., OscillatorNode)
    // this.audioNode.start(0);
}
```

**Skip this method if your node has no parameters to initialize.**

### 7. Implement getAudioParam() (Optional - Usually Not Needed!)

**Most nodes don't need this!** `AudioService` provides automatic `getAudioParam()` based on inlet definitions.

Only implement if:

- Your node has special logic for exposing AudioParams (e.g., mapping different names)
- You need custom behavior beyond property access

For standard nodes, just mark audio parameters with `isAudioParam: true` in inlet definitions:

```typescript
static inlets: ObjectInlet[] = [
    {
        name: 'frequency',
        type: 'float',
        isAudioParam: true,  // ← AudioService handles getAudioParam automatically!
        // ...
    }
];
```

If you need custom implementation:

```typescript
getAudioParam(name: string): AudioParam | null {
    return match(name)
        .with('frequency', () => this.audioNode.frequency)
        .with('detune', () => this.audioNode.detune)
        .otherwise(() => null);
}
```

### 8. Implement send() (Optional - Usually Not Needed!)

**Most nodes don't need this!** `AudioService` provides automatic `send()` based on inlet definitions.

Only implement if:

- Your node has special message logic (e.g., string type changes, unit conversion)
- You need custom validation or transformation

For standard nodes, just mark audio parameters with `isAudioParam: true`:

```typescript
static inlets: ObjectInlet[] = [
    {
        name: 'gain',
        type: 'float',
        isAudioParam: true,  // ← AudioService handles send() automatically!
        // ...
    }
];
```

If you need custom implementation (e.g., for unit conversion):

```typescript
send(key: string, message: unknown): void {
    if (key === 'time' && typeof message === 'number') {
        // Convert milliseconds to seconds
        const seconds = message / 1000;
        this.audioNode.delayTime.value = Math.min(seconds, 1.0);
    }
}
```

**Example**: `DelayNode` handles unit conversion (ms → seconds) in `send()`.

### 9. Implement destroy() (Optional)

**Most nodes don't need this!** AudioService automatically calls `audioNode.disconnect()` when removing a node.

Only implement `destroy()` if you need special cleanup beyond disconnecting:

```typescript
// Only needed for source nodes that must be stopped
destroy(): void {
    try {
        this.audioNode.stop();  // OscillatorNode, etc.
    } catch {
        // Ignore stop errors
    }

    this.audioNode.disconnect();
}
```

**Examples:**

- **GainNode, filters, effects**: No `destroy()` needed ✅
- **OscillatorNode**: Needs `destroy()` to call `.stop()` ⚠️
- **Nodes with timers/intervals**: Needs `destroy()` to clear them ⚠️

### 10. Register Node

Update `ui/src/lib/audio/v2/nodes/index.ts`:

```typescript
import { GainNodeV2 } from "./GainNode";

export function registerAudioNodes(): void {
  const audioService = AudioService.getInstance();

  audioService.define(OscNode);
  audioService.define(GainNodeV2); // Add new node
}
```

### 11. Remove ALL V1 References

**This is critical!** Remove all V1 references to the node:

1. **Remove from `AudioSystem.ts`**:

   - Remove the `create[NodeName]()` method
   - Remove the `.with('node~', () => this.create[NodeName](...))` case from `createAudioObject()`
   - Remove match cases in `getAudioParam()` method
   - Remove match cases in `send()` method (if handling messages)

2. **Remove from `audio-node-types.ts`**:

   - Remove the interface definition (e.g., `interface GainNodeV2`)
   - Remove from the `V1PatchAudioNode` union type

3. **Remove from `audio-node-group.ts`**:

   - Remove from the `P.union()` in the V1 fallback section
   - **Note**: V2 nodes automatically work via registry lookup - no manual updates needed!

4. **Remove from `object-definitions.ts`**:
   - Remove the entire object definition entry from `objectDefinitionsV1`

After cleanup, the node name should **only appear once** in the codebase: in the V2 class's `static name` property. Usage sites (like `createAudioObject(nodeId, 'gain~', [])`) will automatically use the V2 implementation.

### How V2 Nodes Work Automatically

The migration architecture ensures V2 nodes "just work" without manual registration everywhere:

1. **Group Detection** (`audio-node-group.ts`):

   - Checks V2 registry first via `AudioService.getNodeGroup()`
   - Falls back to V1 pattern matching only if not found
   - No manual updates needed for new V2 nodes ✨

2. **Node Creation** (`AudioSystem.createAudioObject()`):

   - Checks V2 registry first via `AudioService.isNodeTypeDefined()`
   - Falls back to V1 switch statement only if not found
   - Automatically uses V2 implementation when available

3. **Connection Validation** (`AudioService.validateEdge()`):
   - Uses V2 node groups for validation
   - Falls back to V1 validation for unmigrated nodes

## Common Patterns

### Audio Parameter Inlets (Simplified!)

For parameters that map to Web Audio `AudioParam`:

```typescript
static inlets = [
    {
        name: 'frequency',
        type: 'float',
        isAudioParam: true,  // ← That's it! AudioService provides getAudioParam() and send()
        defaultValue: 1000,
        minNumber: 0,
        maxNumber: 22050
    }
];

create(params: unknown[]): void {
    const [, frequency] = params as [unknown, number];
    this.audioNode.frequency.value = frequency ?? 1000;
}
```

**No need for custom `getAudioParam()` or `send()` methods!**

If you need custom logic:

- Override `send()` for unit conversion or special handling (e.g., `DelayNode`)
- Override `getAudioParam()` for complex property mapping

### Source Nodes

Nodes that generate audio (e.g., oscillators):

- Group: `'sources'`
- Must call `.start()` in `create()`
- Must call `.stop()` in `destroy()`
- No audio input inlet needed

### Processor Nodes

Nodes that process audio (e.g., gain, filters):

- Group: `'processors'`
- First inlet should be audio input: `{ name: 'in', type: 'signal' }`
- Additional inlets for parameters
- **No `destroy()` needed** - AudioService handles disconnect automatically

### Destination Nodes

Nodes that output audio (e.g., dac~):

- Group: `'destinations'`
- Only have audio input, no output
- **Simple pattern**: Create the audio node in constructor - connections handled automatically by `AudioService.updateEdges()`
- This allows multiple instances (e.g., multiple `dac~` nodes) in a patch
- **Important**: `AudioService.updateEdges()` must be called (happens in `FlowCanvasInner.svelte`) to connect destination nodes to `outGain`

**Example**:

```typescript
constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;
    // No manual connection needed - updateEdges() handles it
}

create(): void {}  // Empty - no parameters to initialize
```

**Architecture Note**: Both V1 `AudioSystem.updateEdges()` and V2 `AudioService.updateEdges()` are called from `FlowCanvasInner.svelte`. V2's `updateEdges()` reconnects all destination nodes to `outGain` by checking `group === 'destinations'` in the registry.

## Automation Opportunities

To automate this migration, an automated tool should:

1. **Parse V1 Implementation**

   - Extract method name from `AudioSystem.ts`
   - Parse parameter destructuring
   - Identify Web Audio API node type
   - Extract parameter names and types

2. **Determine Node Group**

   - Use `audio-node-group.ts` mapping
   - Map to V2 groups: sources/processors/destinations

3. **Generate Inlet Definitions**

   - First parameter is often ignored (reserved for future use)
   - Map remaining parameters to inlets
   - Detect AudioParam usage
   - Add signal input for processors

4. **Generate Outlet Definitions**

   - All nodes except destinations have signal output

5. **Generate Methods**

   - `create()`: Copy parameter parsing and initialization
   - `getAudioParam()`: Detect AudioParam properties
   - `send()`: Generate handlers for each inlet
   - `destroy()`: Only for sources - most nodes don't need this!

6. **Handle Naming Conflicts**

   - Check if class name conflicts with Web Audio API
   - Add `Patch` prefix if needed (e.g., `PatchGainNode`)

7. **Register Node**

   - Add import statement to `v2/nodes/index.ts`
   - Add to `registerAudioNodes()` function
   - **That's it!** No other manual updates needed

8. **Remove V1 References** (can be automated)
   - Remove from `AudioSystem.ts` (method + switch case + getAudioParam + send)
   - Remove from `audio-node-types.ts` (interface + union type)
   - Remove from `audio-node-group.ts` (V1 fallback pattern)
   - Remove from `object-definitions.ts` (V1 definition)

### Why V2 Nodes Need Minimal Registration

The registry-based architecture means V2 nodes automatically work everywhere:

- ✅ **Group detection**: `AudioService.getNodeGroup()` reads from registry
- ✅ **Node creation**: `AudioService.createNode()` uses registry
- ✅ **Validation**: Uses V2 node groups from registry
- ✅ **Metadata**: All metadata in node class (inlets, outlets, description)
- ✅ **Special behavior**: Nodes access shared resources via `AudioService.getInstance()` directly in their constructors (no hardcoding needed)

## Recent Improvements (January 2026)

### Phase 1: Optional Method Architecture

Made `create()`, `send()`, and `getAudioParam()` optional in the `AudioNodeV2` interface:

- AudioService now uses optional chaining: `node.create?.(params)`
- Nodes only implement methods they actually need
- Results in cleaner, more minimal code

### Phase 2: Default Implementations via Inlet Definitions

Introduced **automatic default implementations** for `getAudioParam()` and `send()`:

**Key Innovation**: `AudioService` now provides sensible defaults based on inlet definitions:

1. **For `getAudioParam()`**: Automatically maps AudioParam names to node properties if the inlet is marked `isAudioParam: true`
2. **For `send()`**: Automatically routes numeric messages to AudioParam properties

**How it works**:

```typescript
static inlets = [
    {
        name: 'frequency',
        isAudioParam: true  // ← This is ALL you need!
    }
];

// No need for getAudioParam() or send() - AudioService provides defaults!
```

This means nodes only need custom implementations if they have special logic (like unit conversion).

### Phase 3: Batch Refactoring of All V2 Nodes (14 nodes cleaned up!)

Successfully refactored all migrated V2 nodes to use default implementations:

**Nodes Refactored** (removed boilerplate):

- ✅ `gain~` - Removed custom `getAudioParam()` and `send()`
- ✅ `sig~` - Removed custom `getAudioParam()` and `send()`
- ✅ `+~` - Already minimal
- ✅ `pan~` - Removed custom `getAudioParam()` and `send()`
- ✅ `lowpass~`, `highpass~`, `bandpass~`, `allpass~`, `notch~`, `lowshelf~`, `highshelf~`, `peaking~` - All removed boilerplate

**Nodes with Custom Implementations** (kept where needed):

- ⚠️ `delay~` - Kept custom `send()` for unit conversion (ms → seconds)
- ⚠️ `osc~` - Kept custom `send()` for type string changes and PeriodicWave handling

**Impact**:

- Removed ~400+ lines of boilerplate code
- Each simple node reduced by 15-25 lines
- Eliminated `match` and `ts-pattern` imports from 13 nodes
- Pattern now scales: New nodes only need inlets definition + `create()` method

## Next Steps

### High Priority (Easy wins with new default system)

- [ ] Migrate remaining simple V1 nodes:
  - Effect nodes (compressor~, waveshaper~, convolver~) - now much easier with defaults
  - Utility nodes (merge~, split~) - moderate effort
  - Any processor with audio parameters - trivial with new pattern

### Medium Priority

- [ ] Build automated migration script (code generation from V1 → V2)
  - Much simpler now - just needs inlets definition + create() method
  - Can auto-generate stubs for common Web Audio nodes
- [ ] Create batch migration tool for similar node types (e.g., all filters, all effects)

### Long Term

- [ ] Eventually deprecate V1 system once all nodes are migrated
- [ ] Consider code generation for inlet definitions from Web Audio API specs
