# 55. Worker-to-Render Direct Messaging

## Overview

Bypass the main thread when sending messages from worker-based nodes to FBO-enabled render nodes (`canvas`, `three`, `hydra`, `textmode`).

This is implemented as a **node-agnostic service** (`RenderChannelService`) that any worker-based node system can use - JS workers today, WASM workers in the future.

**Current flow:**

```
Source Worker → Main Thread (MessageSystem) → Render Worker
```

**New flow:**

```
Source Worker → [MessageChannel] → Render Worker
```

## Design Decisions

| Decision         | Choice                                                     |
| ---------------- | ---------------------------------------------------------- |
| Channel topology | Single shared channel per source worker to render worker   |
| Outlet filtering | Filter in source worker (worker knows its own connections) |
| Channel setup    | Lazy - only on first worker→render edge                    |

## Architecture

### RenderChannelService

A standalone singleton service on the main thread that manages direct channels between any worker-based nodes and the render worker.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Thread                              │
│  ┌─────────────────┐      ┌──────────────────────┐              │
│  │ WorkerNodeSystem│─────▶│ RenderChannelService │              │
│  └─────────────────┘      │                      │              │
│  ┌─────────────────┐      │  - registerWorker()  │              │
│  │ (Future) Wasm   │─────▶│  - unregisterWorker()│              │
│  │   NodeSystem    │      │  - updateEdges()     │              │
│  └─────────────────┘      └──────────┬───────────┘              │
│                                      │                          │
│                           Creates MessageChannel                │
│                                      │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        │
     ┌─────────────┐          ┌─────────────┐                   │
     │   port1     │          │   port2     │                   │
     │ (to source  │          │ (to render  │                   │
     │   worker)   │          │   worker)   │                   │
     └─────────────┘          └─────────────┘                   │
```

### Message Flow

1. **Worker registration** (e.g., WorkerNodeSystem creates a worker):

   ```typescript
   RenderChannelService.getInstance().registerWorker(nodeId, worker);
   ```

2. **Edge change detected** (first worker→render edge):

   - Service creates `MessageChannel`
   - `port1` transferred to source worker
   - `port2` transferred to render worker

3. **Connection sync** (on every relevant edge change):

   - Service computes filtered connection graph (worker→render only)
   - Syncs to source worker: `{ outlet: N, targetNodeId: 'xyz', inlet: M }`

4. **Worker sends message**:

   - Worker checks local connection map
   - If outlet connects to render node(s), send via render port
   - Also sends via main thread for non-render targets

5. **Render worker receives message via port**:
   - Dispatch to `FBORenderer.sendMessageToNode(targetNodeId, message)`

## Files to Create/Modify

### 1. NEW: `src/lib/messages/RenderChannelService.ts`

```typescript
import { GLSystem } from "$lib/canvas/GLSystem";

export interface RenderConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

// Render node types that live in the render worker
const RENDER_NODE_TYPES = new Set(["canvas", "three", "hydra", "textmode"]);

export class RenderChannelService {
  private static instance: RenderChannelService;

  private registeredWorkers = new Map<string, Worker>();
  private workersWithChannels = new Set<string>();
  private edges: Array<{
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }> = [];
  private nodeTypes = new Map<string, string>();

  static getInstance(): RenderChannelService;

  /** Register a worker-based node. */
  registerWorker(nodeId: string, worker: Worker): void;

  /** Unregister and clean up. */
  unregisterWorker(nodeId: string): void;

  /** Update node types from flow graph. */
  updateNodeTypes(nodes: Array<{ id: string; type: string }>): void;

  /** Update edges and sync connections to affected workers. */
  updateEdges(edges: Array<{ ... }>): void;

  private hasRenderConnections(nodeId: string): boolean;
  private setupChannel(nodeId: string): void;
  private syncConnectionsToWorker(nodeId: string): void;
  private parseHandleIndex(handle?: string | null): number;
}
```

### 2. `src/lib/js-runner/WorkerNodeSystem.ts`

**Changes:**

```typescript
import { RenderChannelService } from "$lib/messages/RenderChannelService";

// In create():
async create(nodeId: string): Promise<void> {
  // ... existing worker creation ...

  // Register for direct render messaging
  RenderChannelService.getInstance().registerWorker(nodeId, worker);
}

// In destroy():
destroy(nodeId: string): void {
  // ... existing cleanup ...

  RenderChannelService.getInstance().unregisterWorker(nodeId);
}
```

### 3. `src/workers/js/jsWorker.ts`

**New state in NodeState:**

```typescript
interface NodeState {
  // ... existing fields ...
  renderPort: MessagePort | null;
  renderConnections: RenderConnection[];
}
```

**New message handlers:**

```typescript
.with({ type: 'setRenderPort' }, () => {
  const state = getNodeState(nodeId);
  state.renderPort = (event as MessageEvent).ports[0];
  state.renderPort.start();
})

.with({ type: 'updateRenderConnections' }, (data) => {
  const state = getNodeState(nodeId);
  state.renderConnections = data.connections;
})
```

**Modified `send()` function:**

```typescript
const send = (data: unknown, options?: { to?: number }) => {
  const state = getNodeState(nodeId);

  // Send directly to render targets if available
  if (state.renderPort && state.renderConnections.length > 0) {
    const renderTargets = state.renderConnections.filter(
      (c) => options?.to === undefined || c.outlet === options.to
    );

    for (const target of renderTargets) {
      state.renderPort.postMessage({
        fromNodeId: nodeId,
        targetNodeId: target.targetNodeId,
        inlet: target.inlet,
        inletKey: target.inletKey,
        data,
      });
    }
  }

  // Always also send via main thread for non-render targets
  postResponse({ type: "sendMessage", nodeId, data, options });
};
```

### 4. `src/lib/canvas/GLSystem.ts`

**New methods:**

```typescript
/** Register a worker's render port (called by RenderChannelService). */
registerWorkerRenderPort(nodeId: string, port: MessagePort): void {
  this.renderWorker.postMessage(
    { type: 'registerWorkerRenderPort', nodeId },
    [port]
  );
}

/** Unregister a worker's render port. */
unregisterWorkerRenderPort(nodeId: string): void {
  this.send('unregisterWorkerRenderPort', { nodeId });
}
```

### 5. `src/workers/rendering/renderWorker.ts`

**New state:**

```typescript
const workerRenderPorts = new Map<string, MessagePort>();
```

**New message handlers:**

```typescript
.with('registerWorkerRenderPort', () => {
  const port = event.ports[0];
  workerRenderPorts.set(data.nodeId, port);

  port.onmessage = (e) => {
    const { targetNodeId, inlet, inletKey, data: msgData, fromNodeId } = e.data;
    fboRenderer.sendMessageToNode(targetNodeId, {
      data: msgData,
      source: fromNodeId,
      inlet,
      inletKey,
    });
  };

  port.start();
})

.with('unregisterWorkerRenderPort', () => {
  const port = workerRenderPorts.get(data.nodeId);
  if (port) {
    port.close();
    workerRenderPorts.delete(data.nodeId);
  }
})
```

### 6. Integration (flow state manager or Canvas.svelte)

Wire up edge/node updates:

```typescript
// When edges change
RenderChannelService.getInstance().updateEdges(edges);

// When nodes change
RenderChannelService.getInstance().updateNodeTypes(
  nodes.map((n) => ({ id: n.id, type: n.type }))
);
```

## Implementation Steps

### Phase 1: Create RenderChannelService

1. Create `src/lib/messages/RenderChannelService.ts`
2. Implement singleton, worker registration, edge tracking
3. Implement channel setup and connection sync logic

### Phase 2: Render Worker Support

1. Add `registerWorkerRenderPort` handler to renderWorker.ts
2. Add `unregisterWorkerRenderPort` handler
3. Add port message handler routing to FBORenderer

### Phase 3: GLSystem Bridge

1. Add `registerWorkerRenderPort()` to GLSystem
2. Add `unregisterWorkerRenderPort()` to GLSystem

### Phase 4: JS Worker Integration

1. Add `setRenderPort` handler to jsWorker.ts
2. Add `updateRenderConnections` handler
3. Modify `send()` to use render port
4. Call service in WorkerNodeSystem create/destroy

### Phase 5: Wire Up Updates

1. Find where edges are updated
2. Call `updateEdges()` on RenderChannelService
3. Call `updateNodeTypes()` on RenderChannelService

## Future Extensions

### Adding WASM Worker Support

```typescript
// Future WasmNodeSystem - same pattern
class WasmNodeSystem {
  async create(nodeId: string): Promise<void> {
    const worker = new WasmWorker();
    // ... setup ...

    // Same registration API
    RenderChannelService.getInstance().registerWorker(nodeId, worker);
  }
}
```

The WASM worker implements the same protocol:

- Handle `setRenderPort` to receive the port
- Handle `updateRenderConnections` for connection info
- Use port to send directly to render worker

### Other Future Worker Types

Any worker-based node can use this service:

- Python via Pyodide
- Lua via Fengari
- Custom DSLs compiled to WASM

## Edge Cases

1. **Worker connects to both render and non-render nodes**: Send via both paths
2. **Connection removed**: Update connection map, keep channel alive for reconnection
3. **Worker destroyed**: Close port, remove from maps
4. **Render node destroyed**: Render worker ignores unknown target IDs

## Testing

1. Connect worker → canvas, verify direct messaging
2. Connect worker → canvas + js, verify both paths work
3. Disconnect/reconnect, verify channel reuse
4. Delete worker node, verify cleanup
5. Performance: measure latency reduction
6. Multiple workers simultaneously

## Future Optimizations

- Per-connection channels if single channel becomes bottleneck
- Transferable objects (ArrayBuffer, ImageBitmap) via direct channel
- Bidirectional channel for render→worker communication
