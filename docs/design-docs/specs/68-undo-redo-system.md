# 68. Undo/Redo System

Command-pattern based undo/redo for canvas operations (node/edge mutations).

## Overview

Implement a history system that tracks reversible commands for canvas operations. Users can undo (Cmd+Z) and redo (Cmd+Shift+Z) their actions.

## Command Pattern Architecture

### Core Types

```typescript
// src/lib/history/types.ts

export interface Command {
  /** Human-readable description for debugging */
  description: string;

  /** Execute the command (also used for redo) */
  execute(): void;

  /** Reverse the command */
  undo(): void;
}

export interface HistoryState {
  /** Stack of executed commands */
  undoStack: Command[];

  /** Stack of undone commands (cleared on new action) */
  redoStack: Command[];

  /** Maximum history size */
  maxSize: number;
}
```

### History Manager

```typescript
// src/lib/history/HistoryManager.ts

export class HistoryManager {
  private static instance: HistoryManager;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize = 100;

  /** Whether we're currently executing an undo/redo (prevents re-recording) */
  private isUndoingOrRedoing = false;

  /** Execute and record a command */
  execute(command: Command): void {
    if (this.isUndoingOrRedoing) return;

    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action

    // Trim history if too large
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  /** Undo the last command */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    this.isUndoingOrRedoing = true;
    try {
      command.undo();
      this.redoStack.push(command);
    } finally {
      this.isUndoingOrRedoing = false;
    }
    return true;
  }

  /** Redo the last undone command */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    this.isUndoingOrRedoing = true;
    try {
      command.execute();
      this.undoStack.push(command);
    } finally {
      this.isUndoingOrRedoing = false;
    }
    return true;
  }

  /** Check if undo is available */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clear all history (e.g., when loading a new patch) */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  static getInstance(): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager();
    }
    return HistoryManager.instance;
  }
}
```

## Command Implementations

### Node Commands

```typescript
// src/lib/history/commands/node-commands.ts

import type { Node } from "@xyflow/svelte";

export class AddNodeCommand implements Command {
  constructor(
    private node: Node,
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void,
  ) {}

  description = `Add node ${this.node.type}`;

  execute(): void {
    this.setNodes([...this.getNodes(), this.node]);
  }

  undo(): void {
    this.setNodes(this.getNodes().filter((n) => n.id !== this.node.id));
  }
}

export class DeleteNodesCommand implements Command {
  private deletedEdges: Edge[] = [];

  constructor(
    private nodes: Node[],
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void,
    private getEdges: () => Edge[],
    private setEdges: (edges: Edge[]) => void,
  ) {}

  description = `Delete ${this.nodes.length} node(s)`;

  execute(): void {
    const nodeIds = new Set(this.nodes.map((n) => n.id));

    // Store edges that will be deleted (connected to these nodes)
    this.deletedEdges = this.getEdges().filter(
      (e) => nodeIds.has(e.source) || nodeIds.has(e.target),
    );

    // Remove nodes and their edges
    this.setNodes(this.getNodes().filter((n) => !nodeIds.has(n.id)));
    this.setEdges(
      this.getEdges().filter(
        (e) => !nodeIds.has(e.source) && !nodeIds.has(e.target),
      ),
    );
  }

  undo(): void {
    // Restore nodes
    this.setNodes([...this.getNodes(), ...this.nodes]);

    // Restore edges
    this.setEdges([...this.getEdges(), ...this.deletedEdges]);
  }
}

export class MoveNodesCommand implements Command {
  constructor(
    private nodeIds: string[],
    private oldPositions: Map<string, { x: number; y: number }>,
    private newPositions: Map<string, { x: number; y: number }>,
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void,
  ) {}

  description = `Move ${this.nodeIds.length} node(s)`;

  execute(): void {
    this.setNodes(
      this.getNodes().map((node) => {
        const newPos = this.newPositions.get(node.id);
        return newPos ? { ...node, position: newPos } : node;
      }),
    );
  }

  undo(): void {
    this.setNodes(
      this.getNodes().map((node) => {
        const oldPos = this.oldPositions.get(node.id);
        return oldPos ? { ...node, position: oldPos } : node;
      }),
    );
  }
}

export class UpdateNodeDataCommand implements Command {
  constructor(
    private nodeId: string,
    private oldData: Record<string, unknown>,
    private newData: Record<string, unknown>,
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void,
  ) {}

  description = `Update node data`;

  execute(): void {
    this.setNodes(
      this.getNodes().map((node) =>
        node.id === this.nodeId ? { ...node, data: this.newData } : node,
      ),
    );
  }

  undo(): void {
    this.setNodes(
      this.getNodes().map((node) =>
        node.id === this.nodeId ? { ...node, data: this.oldData } : node,
      ),
    );
  }
}
```

### Edge Commands

```typescript
// src/lib/history/commands/edge-commands.ts

import type { Edge } from "@xyflow/svelte";

export class AddEdgeCommand implements Command {
  constructor(
    private edge: Edge,
    private getEdges: () => Edge[],
    private setEdges: (edges: Edge[]) => void,
  ) {}

  description = `Connect ${this.edge.source} → ${this.edge.target}`;

  execute(): void {
    this.setEdges([...this.getEdges(), this.edge]);
  }

  undo(): void {
    this.setEdges(this.getEdges().filter((e) => e.id !== this.edge.id));
  }
}

export class DeleteEdgesCommand implements Command {
  constructor(
    private edges: Edge[],
    private getEdges: () => Edge[],
    private setEdges: (edges: Edge[]) => void,
  ) {}

  description = `Delete ${this.edges.length} edge(s)`;

  execute(): void {
    const edgeIds = new Set(this.edges.map((e) => e.id));
    this.setEdges(this.getEdges().filter((e) => !edgeIds.has(e.id)));
  }

  undo(): void {
    this.setEdges([...this.getEdges(), ...this.edges]);
  }
}
```

### Batch Command

```typescript
// src/lib/history/commands/batch-command.ts

/** Groups multiple commands into a single undoable action */
export class BatchCommand implements Command {
  constructor(
    private commands: Command[],
    public description: string,
  ) {}

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute();
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}
```

## Integration with FlowCanvasInner

### State Accessor Pattern

Since nodes/edges are `$state.raw` in the component, we need accessor functions:

```typescript
// In FlowCanvasInner.svelte

let historyManager = HistoryManager.getInstance();

// Accessors for commands
const getNodes = () => nodes;
const setNodes = (newNodes: Node[]) => {
  nodes = newNodes;
};
const getEdges = () => edges;
const setEdges = (newEdges: Edge[]) => {
  edges = newEdges;
};

// Wrap node creation
function createNodeWithHistory(
  type: string,
  position: { x: number; y: number },
  customData?: any,
): string {
  const id = `${type}-${nodeIdCounter++}`;
  const newNode: Node = {
    id,
    type,
    position,
    data: customData ?? getDefaultNodeData(type),
  };

  historyManager.execute(new AddNodeCommand(newNode, getNodes, setNodes));
  return id;
}
```

### Keyboard Shortcuts

Add to `handleGlobalKeydown`:

```typescript
// Undo: Cmd+Z
if (
  event.key === "z" &&
  (event.metaKey || event.ctrlKey) &&
  !event.shiftKey &&
  !isTyping
) {
  event.preventDefault();

  if (historyManager.undo()) {
    toast.success("Undo");
  }
}

// Redo: Cmd+Shift+Z or Cmd+Y
if (
  ((event.key === "z" && event.shiftKey) || event.key === "y") &&
  (event.metaKey || event.ctrlKey) &&
  !isTyping
) {
  event.preventDefault();

  if (historyManager.redo()) {
    toast.success("Redo");
  }
}
```

## Handling Node Drags (Debouncing)

Node position changes during drag need special handling:

```typescript
// Track drag state
let dragStartPositions: Map<string, { x: number; y: number }> | null = null;

// On SvelteFlow
<SvelteFlow
  onnodedragstart={(event) => {
    // Capture starting positions of all dragged nodes
    dragStartPositions = new Map(
      event.nodes.map(n => [n.id, { ...n.position }])
    );
  }}
  onnodedragstop={(event) => {
    if (!dragStartPositions) return;

    // Create command with old and new positions
    const newPositions = new Map(
      event.nodes.map(n => [n.id, { ...n.position }])
    );

    historyManager.execute(new MoveNodesCommand(
      event.nodes.map(n => n.id),
      dragStartPositions,
      newPositions,
      getNodes,
      setNodes
    ));

    dragStartPositions = null;
  }}
/>
```

## Edge Connection Handling

XYFlow fires `onconnect` when edges are created:

```typescript
<SvelteFlow
  onconnect={(connection) => {
    const newEdge: Edge = {
      id: `edge-${edgeIdCounter++}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle
    };

    historyManager.execute(new AddEdgeCommand(newEdge, getEdges, setEdges));
  }}
/>
```

## Code Edit Handling (Separate Undo Domains)

**Decision**: Use separate undo domains for code editing vs patch structure.

- **CodeMirror handles its own undo** while user is typing (Cmd+Z = undo keystrokes)
- **Patch-level undo** only sees "committed" code changes (on blur)
- This matches Max/MSP behavior and avoids fighting two undo systems

See **Phase 5** below for implementation details.

## Clear History on Patch Load

When loading a new patch, clear the history:

```typescript
async function restorePatchFromSave(save: PatchSaveFormat) {
  historyManager.clear();
  // ... existing restore logic
}

function confirmNewPatch() {
  historyManager.clear();
  // ... existing new patch logic
}
```

## File Structure

```
src/lib/history/
├── HistoryManager.ts
├── types.ts
├── index.ts
└── commands/
    ├── index.ts
    ├── add-node.command.ts
    ├── add-nodes.command.ts
    ├── delete-nodes.command.ts
    ├── move-nodes.command.ts
    ├── add-edge.command.ts
    ├── add-edges.command.ts
    ├── delete-edges.command.ts
    ├── batch-command.ts
    ├── node-commands.test.ts
    └── edge-commands.test.ts
```

## Implementation Phases

### Phase 1: Core Infrastructure ✅

- [x] Create `HistoryManager` singleton
- [x] Implement base `Command` interface
- [x] Add keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)

### Phase 2: Node Operations ✅

- [x] `AddNodeCommand` - creating nodes
- [x] `AddNodesCommand` - creating multiple nodes at once
- [x] `DeleteNodesCommand` - deleting nodes (with edge cleanup)
- [x] `MoveNodesCommand` - drag position changes

### Phase 3: Edge Operations ✅

- [x] `AddEdgeCommand` - connecting nodes
- [x] `AddEdgesCommand` - connecting multiple edges at once
- [x] `DeleteEdgesCommand` - disconnecting nodes

### Phase 4: Batch Operations ✅

- [x] `BatchCommand` - for paste, AI multi-insert
- [x] Update copy/paste to use commands
- [x] Update AI insertion to use commands

### Phase 5: Node Data Changes (Separate Undo Domains)

**Strategy: Option A - Separate Undo Domains** (like Max/MSP)

Code editing has its own undo system (CodeMirror), separate from patch-level undo:

- **While focused on code editor**: Cmd+Z uses CodeMirror's internal undo (character-level)
- **While focused on canvas**: Cmd+Z uses patch-level undo (structural changes)
- **Committed code changes**: When code editor loses focus (blur), if code changed, record as a single patch-level undo entry

This avoids the complexity of merging two undo systems and matches user expectations:

- Typing in code → Cmd+Z undoes typing (CodeMirror)
- Clicking away, then Cmd+Z → undoes the entire code edit as one unit

**Implementation:** ✅

- [x] Track `valueOnFocus` in CodeEditor component
- [x] On blur, emit `codeCommit` event via PatchiesEventBus (if nodeId provided)
- [x] Create `UpdateNodeDataCommand` for node data changes
- [x] Add `handleCodeCommit` listener in FlowCanvasInner
- [x] Pass `nodeId` and `dataKey` props to all CodeEditor usages

```typescript
// CodeEditor.svelte - emits event on blur if nodeId is provided
blur: (_event, view) => {
  if (nodeId && currentValue !== valueOnFocus) {
    PatchiesEventBus.getInstance().dispatch({
      type: 'codeCommit',
      nodeId,
      dataKey,  // 'code', 'expr', 'message', 'prompt', etc.
      oldValue: valueOnFocus,
      newValue: currentValue
    });
  }
}

// FlowCanvasInner.svelte - single listener handles all code commits
const handleCodeCommit = (e: CodeCommitEvent) => {
  historyManager.record(
    new UpdateNodeDataCommand(e.nodeId, e.dataKey, e.oldValue, e.newValue, canvasAccessors)
  );
};

// Usage in nodes - just pass nodeId and optional dataKey
<CodeEditor value={code} {nodeId} />                    // dataKey defaults to 'code'
<CodeEditor value={expr} {nodeId} dataKey="expr" />     // for expression nodes
<CodeEditor value={prompt} {nodeId} dataKey="prompt" /> // for AI nodes
```

### Phase 6: Generic Node Data Tracking

For non-CodeMirror node data (colors, toggles, text inputs), we provide `useNodeDataTracker` hook:

**Implementation:** ✅

- [x] Create `NodeDataCommitEvent` in eventbus (generic version of `CodeCommitEvent`)
- [x] Create `useNodeDataTracker` hook with two modes:
  - `commit(key, oldValue, newValue)` - immediate tracking for discrete changes
  - `track(key, getCurrentValue)` - blur-based tracking for continuous inputs
- [x] Add `handleNodeDataCommit` listener in FlowCanvasInner
- [x] Update PostItNode as reference implementation

```typescript
// src/lib/history/useNodeDataTracker.svelte.ts

// Usage in any node component:
import { useNodeDataTracker } from '$lib/history';

const tracker = useNodeDataTracker(node.id);

// For discrete changes (toggles, color pickers, dropdowns)
// Records immediately when called
function handleColorChange(newColor: string) {
  const oldColor = color;
  updateNodeData(node.id, { color: newColor });
  tracker.commit('color', oldColor, newColor);
}

// For continuous changes (text inputs, sliders)
// Records on blur if value changed
const textTracker = tracker.track('text', () => node.data.text ?? '');

// In template:
<input onfocus={textTracker.onFocus} onblur={textTracker.onBlur} />
```

**Nodes that need `useNodeDataTracker`:**

Priority 1 - UI Controls (user directly manipulates):

- [x] `note` - text, color, fontSize, locked
- [x] `slider` - min, max, defaultValue, isFloat, vertical, resizable
- [x] `markdown` - markdown content (OverType editor)

Priority 2 - Settings panels with discrete options:

- [x] `midi.in` - device, channel
- [x] `midi.out` - device, channel
- [x] `keyboard` - key mappings
- [x] `mic~` - device selection
- [x] `out~` - channel layout
- [x] `sampler~` - file, playback settings
- [x] `mqtt` - broker URL, topic
- [x] `sse` - URL
- [x] `tts` - voice selection
- [ ] `ai.music` - settings (no persistent UI settings - prompts managed in memory)
- [x] `ai.tts` - voice selection
- [x] `vdo.ninja.push` - room ID, settings
- [x] `vdo.ninja.pull` - room ID, settings
- [x] `asm` - viewer settings (AssemblyValueViewer)
- [x] `asm.mem` - viewer settings
- [x] `asm` (machine) - stepBy, delayMs settings (AssemblyMachine)
- [x] `orca` - orca code, settings
- [x] `chuck~` - settings (via CodeEditor codeCommit)

Skip/Defer (code-based with codeCommit, or message-only params):

- Code nodes: `js`, `hydra`, `canvas`, `p5`, `glsl`, `worker`, `dom`, `vue`, etc.
- Expression nodes: `expr`, `filter`, `map`, `scan`, `tap`, `uniq`
- Audio V2 nodes: `gain~`, `lowpass~`, etc. (params via messages)
- Control V2 nodes: `send`, `recv`, `kv`, etc. (no UI settings)
- `toggle`, `button` - value changes are programmatic, not user settings

## Edge Cases

1. **Undo after autosave**: History should persist, autosave shouldn't clear it
2. **Undo deleted audio nodes**: AudioService.removeNodeById is called - on undo, the node component re-mounts and re-registers with AudioService
3. **Undo during playback**: Should work, but audio state may be inconsistent
4. **History size limit**: Cap at 100 entries to prevent memory issues
5. **Rapid undos**: Should be safe due to isUndoingOrRedoing guard

## Testing

- [x] Unit tests for each command type (node-commands.test.ts, edge-commands.test.ts)
- [ ] Integration test: create nodes → delete → undo → verify restored
- [ ] Integration test: drag node → undo → verify position
- [ ] Integration test: connect → disconnect → undo → verify edge restored
