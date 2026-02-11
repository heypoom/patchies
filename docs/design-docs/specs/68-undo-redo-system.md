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

import type { Node } from '@xyflow/svelte';

export class AddNodeCommand implements Command {
  constructor(
    private node: Node,
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void
  ) {}

  description = `Add node ${this.node.type}`;

  execute(): void {
    this.setNodes([...this.getNodes(), this.node]);
  }

  undo(): void {
    this.setNodes(this.getNodes().filter(n => n.id !== this.node.id));
  }
}

export class DeleteNodesCommand implements Command {
  private deletedEdges: Edge[] = [];

  constructor(
    private nodes: Node[],
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void,
    private getEdges: () => Edge[],
    private setEdges: (edges: Edge[]) => void
  ) {}

  description = `Delete ${this.nodes.length} node(s)`;

  execute(): void {
    const nodeIds = new Set(this.nodes.map(n => n.id));

    // Store edges that will be deleted (connected to these nodes)
    this.deletedEdges = this.getEdges().filter(
      e => nodeIds.has(e.source) || nodeIds.has(e.target)
    );

    // Remove nodes and their edges
    this.setNodes(this.getNodes().filter(n => !nodeIds.has(n.id)));
    this.setEdges(this.getEdges().filter(
      e => !nodeIds.has(e.source) && !nodeIds.has(e.target)
    ));
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
    private setNodes: (nodes: Node[]) => void
  ) {}

  description = `Move ${this.nodeIds.length} node(s)`;

  execute(): void {
    this.setNodes(this.getNodes().map(node => {
      const newPos = this.newPositions.get(node.id);
      return newPos ? { ...node, position: newPos } : node;
    }));
  }

  undo(): void {
    this.setNodes(this.getNodes().map(node => {
      const oldPos = this.oldPositions.get(node.id);
      return oldPos ? { ...node, position: oldPos } : node;
    }));
  }
}

export class UpdateNodeDataCommand implements Command {
  constructor(
    private nodeId: string,
    private oldData: Record<string, unknown>,
    private newData: Record<string, unknown>,
    private getNodes: () => Node[],
    private setNodes: (nodes: Node[]) => void
  ) {}

  description = `Update node data`;

  execute(): void {
    this.setNodes(this.getNodes().map(node =>
      node.id === this.nodeId ? { ...node, data: this.newData } : node
    ));
  }

  undo(): void {
    this.setNodes(this.getNodes().map(node =>
      node.id === this.nodeId ? { ...node, data: this.oldData } : node
    ));
  }
}
```

### Edge Commands

```typescript
// src/lib/history/commands/edge-commands.ts

import type { Edge } from '@xyflow/svelte';

export class AddEdgeCommand implements Command {
  constructor(
    private edge: Edge,
    private getEdges: () => Edge[],
    private setEdges: (edges: Edge[]) => void
  ) {}

  description = `Connect ${this.edge.source} → ${this.edge.target}`;

  execute(): void {
    this.setEdges([...this.getEdges(), this.edge]);
  }

  undo(): void {
    this.setEdges(this.getEdges().filter(e => e.id !== this.edge.id));
  }
}

export class DeleteEdgesCommand implements Command {
  constructor(
    private edges: Edge[],
    private getEdges: () => Edge[],
    private setEdges: (edges: Edge[]) => void
  ) {}

  description = `Delete ${this.edges.length} edge(s)`;

  execute(): void {
    const edgeIds = new Set(this.edges.map(e => e.id));
    this.setEdges(this.getEdges().filter(e => !edgeIds.has(e.id)));
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
    public description: string
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
const setNodes = (newNodes: Node[]) => { nodes = newNodes; };
const getEdges = () => edges;
const setEdges = (newEdges: Edge[]) => { edges = newEdges; };

// Wrap node creation
function createNodeWithHistory(type: string, position: { x: number; y: number }, customData?: any): string {
  const id = `${type}-${nodeIdCounter++}`;
  const newNode: Node = {
    id,
    type,
    position,
    data: customData ?? getDefaultNodeData(type)
  };

  historyManager.execute(new AddNodeCommand(newNode, getNodes, setNodes));
  return id;
}
```

### Keyboard Shortcuts

Add to `handleGlobalKeydown`:

```typescript
// Undo: Cmd+Z
if (event.key === 'z' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !isTyping) {
  event.preventDefault();
  if (historyManager.undo()) {
    toast.success('Undo');
  }
}

// Redo: Cmd+Shift+Z or Cmd+Y
if (
  ((event.key === 'z' && event.shiftKey) || event.key === 'y') &&
  (event.metaKey || event.ctrlKey) &&
  !isTyping
) {
  event.preventDefault();
  if (historyManager.redo()) {
    toast.success('Redo');
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

## Code Edit Handling

For code blocks, we want to batch edits rather than undo per-keystroke.

### Option A: Blur-based (simpler)
Record state on focus, commit on blur:

```typescript
// In CodeBlockBase.svelte
let codeOnFocus: string | null = null;

function onFocus() {
  codeOnFocus = code;
}

function onBlur() {
  if (codeOnFocus !== null && codeOnFocus !== code) {
    // Emit event to parent to record the change
    dispatch('codeChange', { oldCode: codeOnFocus, newCode: code });
  }
  codeOnFocus = null;
}
```

### Option B: Debounced (better UX)
Use a debounce timer (e.g., 1 second of inactivity):

```typescript
let lastRecordedCode = code;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onCodeChange(newCode: string) {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    if (newCode !== lastRecordedCode) {
      dispatch('codeChange', { oldCode: lastRecordedCode, newCode });
      lastRecordedCode = newCode;
    }
  }, 1000);
}
```

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
├── commands/
│   ├── index.ts
│   ├── node-commands.ts
│   ├── edge-commands.ts
│   └── batch-command.ts
└── index.ts
```

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `HistoryManager` singleton
- [ ] Implement base `Command` interface
- [ ] Add keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)

### Phase 2: Node Operations
- [ ] `AddNodeCommand` - creating nodes
- [ ] `DeleteNodesCommand` - deleting nodes (with edge cleanup)
- [ ] `MoveNodesCommand` - drag position changes

### Phase 3: Edge Operations
- [ ] `AddEdgeCommand` - connecting nodes
- [ ] `DeleteEdgesCommand` - disconnecting nodes

### Phase 4: Batch Operations
- [ ] `BatchCommand` - for paste, AI multi-insert
- [ ] Update copy/paste to use commands
- [ ] Update AI insertion to use commands

### Phase 5: Node Data Changes (optional)
- [ ] `UpdateNodeDataCommand` for code/param changes
- [ ] Debouncing strategy for code edits

## Edge Cases

1. **Undo after autosave**: History should persist, autosave shouldn't clear it
2. **Undo deleted audio nodes**: AudioService.removeNodeById is called - on undo, the node component re-mounts and re-registers with AudioService
3. **Undo during playback**: Should work, but audio state may be inconsistent
4. **History size limit**: Cap at 100 entries to prevent memory issues
5. **Rapid undos**: Should be safe due to isUndoingOrRedoing guard

## Testing

- Unit tests for each command type
- Integration test: create nodes → delete → undo → verify restored
- Integration test: drag node → undo → verify position
- Integration test: connect → disconnect → undo → verify edge restored
