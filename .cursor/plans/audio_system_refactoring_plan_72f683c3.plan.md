---
name: Audio System Refactoring Plan
overview: Migrate audio nodes from V1 (method-based in AudioSystem) to V2 (class-based with AudioNodeV2 interface). Uses a registry-based architecture where nodes are self-contained classes with static metadata. Three nodes migrated so far - osc~, gain~, and dac~.
todos:
  - id: create-v2-structure
    content: "Create v2 directory structure: interfaces/, nodes/ subdirectories"
    status: completed
  - id: define-audionode-interface
    content: Define AudioNodeV2 interface with required methods and static properties
    status: completed
    dependencies:
      - create-v2-structure
  - id: create-audioservice
    content: Create AudioService singleton with node registry, define() method, and graceful V1 fallback
    status: completed
    dependencies:
      - define-audionode-interface
  - id: migrate-osc-node
    content: Migrate osc~ to OscNode class with static metadata (name, group, inlets, outlets)
    status: completed
    dependencies:
      - create-audioservice
  - id: migrate-gain-node
    content: Migrate gain~ to GainNodeV2 class (processor, no destroy needed)
    status: completed
    dependencies:
      - migrate-osc-node
  - id: migrate-dac-node
    content: Migrate dac~ to DacNode class (destination, auto-connects to outGain)
    status: completed
    dependencies:
      - migrate-gain-node
  - id: add-backwards-compatibility
    content: Update AudioSystem to check V2 registry first, then fall back to V1
    status: completed
    dependencies:
      - migrate-osc-node
  - id: remove-v1-references
    content: Remove all V1 references for migrated nodes (AudioSystem, audio-node-types, audio-node-group, object-definitions)
    status: completed
    dependencies:
      - add-backwards-compatibility
  - id: document-migration-process
    content: Create comprehensive migration guide with patterns and automation opportunities
    status: completed
    dependencies:
      - migrate-dac-node
---

# Audio System Refactoring Plan

## Overview

The audio system has been refactored to support class-based audio nodes with a registry-based architecture. V2 nodes are self-contained classes implementing the `AudioNodeV2` interface, with all metadata (inlets, outlets, description, group) defined as static properties. The migration is incremental with full backwards compatibility - V1 and V2 nodes coexist seamlessly.

**Completed Migrations:**
- ✅ `osc~` - Oscillator (source node)
- ✅ `gain~` - Gain/volume control (processor node)
- ✅ `dac~` - Digital-to-analog converter (destination node)

See `docs/design-docs/specs/49-audio-v1-to-v2-migration.md` for detailed migration guide.

## Architecture Design

### Directory Structure

```
ui/src/lib/audio/v2/
├── AudioService.ts          # Singleton service with node registry & shared logic
├── interfaces/
│   └── audio-nodes.ts       # AudioNodeV2 interface & AudioNodeClass type
└── nodes/
    ├── OscNode.ts           # osc~ - oscillator source
    ├── GainNode.ts          # gain~ - volume processor
    ├── DacNode.ts           # dac~ - speaker destination
    └── index.ts             # registerAudioNodes() function
```

### Core Architecture

**Registry-Based System**: Nodes self-register via `AudioService.define()` with static metadata. No hardcoded node names in AudioService.

**AudioNodeV2 Interface**:
- Instance properties: `nodeId`, `audioNode`
- Static properties: `name`, `group`, `description`, `inlets`, `outlets`
- Methods: `create()`, `send()`, `getAudioParam()`, optional `destroy()`

**AudioService Singleton**:
- `registry: Map<string, AudioNodeClass>` - Node class definitions
- `nodesById: Map<string, AudioNodeV2>` - Active node instances
- `outGain: GainNode` - Shared output node
- `define(constructor: AudioNodeClass)` - Register node type
- `createNode(nodeId, nodeType, params)` - Instantiate & track nodes
- `updateEdges(edges)` - Reconnect audio graph (auto-reconnects destination nodes)
- `getNodeGroup(nodeType)` - Lookup node group from registry

**Backwards Compatibility**: AudioSystem checks `AudioService.isNodeTypeDefined()` first, falls back to V1. Migrated nodes removed entirely from V1 code.

## Key Architectural Decisions

### 1. No Hardcoded Node Names
Special behavior lives in node classes, not in AudioService. For example, `dac~` accesses `AudioService.getInstance().outGain` directly in its constructor - no hardcoded `if (nodeType === 'dac~')` logic in AudioService.

### 2. Static Metadata Pattern
Node classes define all metadata as static properties (`name`, `group`, `inlets`, `outlets`, `description`). This enables:
- Dynamic node discovery via registry
- Automatic UI generation from metadata
- Future automation of migration process

### 3. Graceful V1 Fallback
All integration points check V2 registry first, then fall back to V1:
- `AudioSystem.createAudioObject()` → `AudioService.isNodeTypeDefined()`
- `audio-node-group.ts` → `AudioService.getNodeGroup()`
- `AudioSystem.send()` → `AudioService.getNode()`

### 4. Complete V1 Removal
When a node is migrated, ALL V1 references are removed:
- `AudioSystem.ts` - method + match case
- `audio-node-types.ts` - interface + union type
- `audio-node-group.ts` - pattern match case
- `object-definitions.ts` - V1 definition

Node name appears **only once** in codebase: `static name` in V2 class.

### 5. Destination Node Pattern
Destination nodes (like `dac~`) create their audio node in constructor without manual connections. `AudioService.updateEdges()` automatically connects all destination nodes to `outGain` by checking `group === 'destinations'` in registry. Both V1 `AudioSystem.updateEdges()` and V2 `AudioService.updateEdges()` are called from `FlowCanvasInner.svelte`.

### 6. Optional destroy()
Most nodes don't need `destroy()` - AudioService calls `audioNode.disconnect()` by default. Only source nodes with special cleanup (e.g., `OscillatorNode.stop()`) need custom `destroy()`.

## Migrated Nodes

### OscNode (osc~) - Source
- Creates `OscillatorNode`, calls `.start()` in `create()`
- Handles frequency, detune, type, and periodic wave messages
- Has custom `destroy()` to call `.stop()` before disconnect
- AudioParams: `frequency`, `detune`

### GainNodeV2 (gain~) - Processor  
- Creates `GainNode` with configurable gain value
- No custom `destroy()` needed (uses default disconnect)
- AudioParam: `gain`
- Pattern for most processor nodes

### DacNode (dac~) - Destination
- Creates own `GainNode` in constructor (no manual connections)
- Demonstrates destination node pattern (connection handled by `AudioService.updateEdges()`)
- Allows multiple `dac~` instances in a patch
- No outlets (terminal node)
- Empty `create()` method - no parameters to initialize

## Key Files

### V2 System
- `ui/src/lib/audio/v2/AudioService.ts` - Singleton service with registry
- `ui/src/lib/audio/v2/interfaces/audio-nodes.ts` - AudioNodeV2 interface
- `ui/src/lib/audio/v2/nodes/OscNode.ts` - osc~ implementation
- `ui/src/lib/audio/v2/nodes/GainNode.ts` - gain~ implementation
- `ui/src/lib/audio/v2/nodes/DacNode.ts` - dac~ implementation
- `ui/src/lib/audio/v2/nodes/index.ts` - registerAudioNodes()

### V1 Integration Points (Modified)
- `ui/src/lib/audio/AudioSystem.ts` - Checks V2 first, falls back to V1
- `ui/src/lib/audio/audio-node-group.ts` - Checks V2 registry for groups
- `ui/src/lib/audio/audio-node-types.ts` - V1 node type definitions (shrinking)
- `ui/src/lib/objects/object-definitions.ts` - V1 object definitions (shrinking)

## Success Criteria ✅

All criteria met for three migrated nodes (osc~, gain~, dac~):

1. ✅ V2 nodes work identically to V1 nodes
2. ✅ Registry-based system eliminates hardcoded node names
3. ✅ Static metadata enables dynamic node discovery
4. ✅ Graceful V1 fallback maintains backwards compatibility
5. ✅ Complete V1 removal (node name appears only once in codebase)
6. ✅ Destination nodes auto-connect to speakers
7. ✅ AudioParam modulation works
8. ✅ Message passing works
9. ✅ Node cleanup works (optional destroy() for sources only)
10. ✅ Migration guide documented in `docs/design-docs/specs/49-audio-v1-to-v2-migration.md`

## Next Steps

**Priority Nodes to Migrate:**
- `sig~` - Constant signal source (similar pattern to `osc~`)
- `+~` - Signal addition processor (simple processor)
- Filter nodes - `lowpass~`, `highpass~`, `bandpass~`, etc. (similar patterns)
- Effect nodes - `delay~`, `compressor~`, `pan~` (similar patterns)

**Long-term Goals:**
- Automate migration process (code generation from V1 → V2)
- Build batch migration tool for similar node types
- Eventually deprecate V1 system entirely

**Reference:** See `docs/design-docs/specs/49-audio-v1-to-v2-migration.md` for detailed migration steps and patterns.