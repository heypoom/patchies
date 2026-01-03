---
name: Audio System Refactoring Plan
overview: Refactor the audio system to use class-based audio nodes while maintaining backwards compatibility. Start with osc~ node as the first migration target, creating a v2 service layer that can coexist with the existing AudioSystem singleton.
todos:
  - id: create-v2-structure
    content: "Create v2 directory structure: interfaces/, nodes/, adapters/ subdirectories"
    status: completed
  - id: define-audionode-interface
    content: Define PatchAudioNode interface with required methods (create, send, destroy, getAudioParam, connect)
    status: completed
    dependencies:
      - create-v2-structure
  - id: create-audioservice
    content: Create AudioService class with singleton pattern, node registry, connection management, and edge updates
    status: completed
    dependencies:
      - define-iaudionode-interface
  - id: create-oscnode-class
    content: Create OscNode class implementing PatchAudioNode with all osc~ logic from AudioSystem
    status: completed
    dependencies:
      - define-audionode-interface
  - id: add-osc-support-to-audioservice
    content: Add createOscNode method to AudioService and register OscNode instances
    status: completed
    dependencies:
      - create-audioservice
      - create-oscnode-class
  - id: add-backwards-compatibility
    content: Update AudioSystem.createAudioObject() and send() to delegate to AudioService for osc~ nodes
    status: completed
    dependencies:
      - add-osc-support-to-audioservice
  - id: test-osc-node
    content: Test osc~ node creation, messages, connections, AudioParam modulation, and cleanup
    status: completed
    dependencies:
      - add-backwards-compatibility
---

# Audio System Refactoring Plan

## Overview

Refactor the audio system to support class-based audio nodes in a new `v2` directory, starting with `osc~`. The new architecture will use an interface-based design where nodes implement `PatchAudioNode` and `AudioService` provides shared utilities. This refactoring will be done incrementally, one node at a time, with full backwards compatibility.

## Architecture Design

### New Structure

```javascript
ui/src/lib/audio/v2/
├── AudioService.ts          # Service with shared audio logic
├── interfaces/
│   └── PatchAudioNode.ts    # Interface for audio nodes
├── nodes/
│   ├── OscNode.ts          # First migrated node (osc~)
│   └── ...                 # Future node classes
└── adapters/
    └── AudioSystemAdapter.ts # Adapter to bridge v1 and v2
```



### Interface Design

**PatchAudioNode Interface** (`interfaces/PatchAudioNode.ts`):

- `nodeId: string` - Unique identifier
- `audioNode: AudioNode` - The underlying Web Audio API node
- `type: PsAudioType` - Node type identifier
- `create(params: unknown[]): Promise<void>` - Initialize the node
- `send(key: string, message: unknown): void` - Handle incoming messages
- `destroy(): void` - Cleanup resources
- `getAudioParam(name: string): AudioParam | null` - Get AudioParam for modulation
- `connect(target: PatchAudioNode, paramName?: string): void` - Connect to another node

**AudioService** (`AudioService.ts`):

- Provides shared utilities (AudioContext access, connection management)
- Manages registry of active nodes
- Handles edge updates and connection routing
- Provides backwards-compatible adapter methods

## Implementation Steps

### Phase 1: Foundation (v2 Infrastructure)

1. **Create v2 directory structure**

- Create `ui/src/lib/audio/v2/` directory
- Create subdirectories: `interfaces/`, `nodes/`, `adapters/`

2. **Define PatchAudioNode interface** (`interfaces/PatchAudioNode.ts`)

- Define interface with required methods and properties
- Include type definitions for node lifecycle

3. **Create AudioService class** (`AudioService.ts`)

- Singleton pattern (similar to current AudioSystem)
- Methods:
    - `getAudioContext(): AudioContext` - Access to audio context
    - `registerNode(node: PatchAudioNode): void` - Register node in registry
    - `unregisterNode(nodeId: string): void` - Remove from registry
    - `getNode(nodeId: string): PatchAudioNode | null` - Get node by ID
    - `connect(sourceId: string, targetId: string, paramName?: string): void` - Connection logic
    - `updateEdges(edges: Edge[]): void` - Update connections from XY Flow edges
    - `start(): void` - Initialize audio system
- Maintain `outGain` for output management
- Keep compatibility with existing `hasSomeAudioNode` store

4. **Create AudioSystemAdapter** (`adapters/AudioSystemAdapter.ts`)

- Adapter class that bridges v1 AudioSystem and v2 AudioService
- Allows both systems to coexist
- Provides migration path for gradual adoption

### Phase 2: First Node Migration (osc~)

5. **Create OscNode class** (`nodes/OscNode.ts`)

- Implements `PatchAudioNode` interface
- Encapsulates all `osc~` logic from `AudioSystem.createOsc()` and `AudioSystem.send()` for osc~
- Properties:
    - `nodeId: string`
    - `audioNode: OscillatorNode`
    - `type: 'osc~'`
- Methods:
    - `create(params: unknown[]): Promise<void>` - Initialize oscillator with frequency/type
    - `send(key: string, message: unknown): void` - Handle frequency, detune, type, periodic wave messages
    - `destroy(): void` - Stop oscillator and cleanup
    - `getAudioParam(name: string): AudioParam | null` - Return frequency or detune AudioParam
    - `connect(target: PatchAudioNode, paramName?: string): void` - Connect to target node

6. **Update AudioService to support osc~**

- Add `createOscNode(nodeId: string, params: unknown[]): Promise<OscNode>` method
- Register node in internal registry
- Handle connection logic for OscNode

7. **Add backwards compatibility layer**

- Update `AudioSystem.createAudioObject()` to check if node type is migrated
- If migrated (osc~), delegate to `AudioService.getInstance().createOscNode()`
- Store reference in both v1 `nodesById` map (for compatibility) and v2 registry
- Ensure `AudioSystem.send()` and `AudioSystem.getAudioParam()` work with migrated nodes

8. **Update ObjectNode component** (optional, for testing)

- Add feature flag or check to use v2 system for osc~ nodes
- Ensure existing functionality continues to work
- Test that messages, connections, and AudioParam modulation work correctly

### Phase 3: Validation & Testing

9. **Test backwards compatibility**

- Verify existing patches with osc~ nodes continue to work
- Test message passing (`send()` method)
- Test AudioParam connections (frequency, detune modulation)
- Test node connections (osc~ → gain~ → dac~)
- Test node deletion and cleanup

10. **Update documentation**

    - Document new v2 architecture in `docs/design-docs/current-architecture.md`
    - Add migration notes for future nodes

## Key Design Decisions

1. **Backwards Compatibility**: The existing `AudioSystem` singleton remains functional. New nodes are registered in both systems during migration period.
2. **Interface-Based**: Nodes implement `PatchAudioNode` interface, allowing for easy testing and headless operation in the future.
3. **Incremental Migration**: Only one node type (osc~) is migrated initially. Other nodes continue using the existing system.
4. **Shared Logic**: `AudioService` provides utilities like AudioContext access, connection management, and edge updates that all nodes need.
5. **Node-Specific Logic**: Each node class (OscNode) contains all logic specific to that node type, extracted from `AudioSystem`.

## Files to Create/Modify

### New Files

- `ui/src/lib/audio/v2/interfaces/PatchAudioNode.ts`
- `ui/src/lib/audio/v2/AudioService.ts`
- `ui/src/lib/audio/v2/nodes/OscNode.ts`
- `ui/src/lib/audio/v2/adapters/AudioSystemAdapter.ts` (optional, if needed)

### Modified Files

- `ui/src/lib/audio/AudioSystem.ts` - Add compatibility layer for osc~
- `ui/src/lib/components/nodes/ObjectNode.svelte` - Optional: add v2 support flag

## Success Criteria

1. ✅ `osc~` nodes can be created using the new `OscNode` class
2. ✅ Existing patches with `osc~` nodes continue to work without modification
3. ✅ Message passing works (`send()` method handles frequency, detune, type, periodic wave)
4. ✅ AudioParam connections work (frequency and detune can be modulated)
5. ✅ Node connections work (osc~ can connect to other nodes)
6. ✅ Node cleanup works (destroy() properly stops oscillator)
7. ✅ No breaking changes to existing code
8. ✅ Ready for next node migration (gain~, etc.)

## Future Migrations