# 55. Direct Web Worker Messaging (Worker→Render & Worker→Worker)

## Overview

Bypass the main thread when sending messages between worker-based nodes. This enables:

1. **Worker → Render**: Messages from worker nodes to FBO-enabled render nodes (`canvas`, `three`, `hydra`, `textmode`)
2. **Worker → Worker**: Direct peer-to-peer messaging between worker nodes

This is implemented as a **node-agnostic service** (`DirectChannelService`) that any worker-based node system can use - JS workers today, WASM workers in the future.

**Current flow (via main thread):**

```
Source Worker → Main Thread (MessageSystem) → Target Worker/Render Worker
```

**New flow (direct):**

```
Source Worker → [MessageChannel] → Target Worker/Render Worker
```

## Design Decisions

| Decision         | Choice                                                     |
| ---------------- | ---------------------------------------------------------- |
| Channel topology | Single shared channel per source worker to render worker   |
|                  | Per-target channel for worker-to-worker                    |
| Outlet filtering | Filter in source worker (worker knows its own connections) |
| Channel setup    | Lazy - only on first worker→render or worker→worker edge   |

## Architecture

### DirectChannelService

A standalone singleton service on the main thread that manages direct channels between any worker-based nodes and the render worker, as well as between worker nodes themselves.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Thread                              │
│  ┌─────────────────┐      ┌──────────────────────┐              │
│  │ WorkerNodeSystem│─────▶│ DirectChannelService │              │
│  └─────────────────┘      │                      │              │
│  ┌─────────────────┐      │  - registerWorker()  │              │
│  │ (Future) Wasm   │─────▶│  - unregisterWorker()│              │
│  │   NodeSystem    │      │  - updateEdges()     │              │
│  └─────────────────┘      │  - updateNodeTypes() │              │
│                           └──────────┬───────────┘              │
│                                      │                          │
│                           Creates MessageChannels               │
│                                      │                          │
└──────────────────────────────────────┼──────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────┐              ┌─────────────┐              ┌─────────────┐
│ Worker A    │              │ Worker B    │              │ Render      │
│ (port1 for  │──────────────│ (port2 for  │              │ Worker      │
│  sending)   │  Worker→     │  receiving) │              │ (port2)     │
└─────────────┘  Worker      └─────────────┘              └─────────────┘
       │                                                         ▲
       │                    Worker→Render                        │
       └─────────────────────────────────────────────────────────┘
```

### Channel Types

1. **Worker → Render Channel**: Single shared MessageChannel per worker to the render worker
2. **Worker → Worker Channel**: Per-target MessageChannel (one per source→target pair)

### Message Flow

#### Worker → Render

1. **Worker registration** (e.g., WorkerNodeSystem creates a worker):

   ```typescript
   DirectChannelService.getInstance().registerWorker(nodeId, worker);
   ```

2. **Edge change detected** (first worker→render edge):

   - Service creates `MessageChannel`
   - `port1` transferred to source worker
   - `port2` transferred to render worker via GLSystem

3. **Connection sync** (on every relevant edge change):

   - Service computes filtered connection graph (worker→render only)
   - Syncs to source worker: `{ outlet: N, targetNodeId: 'xyz', inlet: M }`

4. **Worker sends message**:

   - Worker checks local connection map
   - If outlet connects to render node(s), send via render port
   - Also sends via main thread for non-direct targets

5. **Render worker receives message via port**:
   - Dispatch to `FBORenderer.sendMessageToNode(targetNodeId, message)`

#### Worker → Worker

1. **Edge change detected** (worker→worker edge):

   - Service creates `MessageChannel`
   - `port1` transferred to source worker (for sending)
   - `port2` transferred to target worker (for receiving)

2. **Connection sync**:

   - Service computes filtered connection graph (worker→worker only)
   - Syncs to source worker: `{ outlet: N, targetNodeId: 'xyz', inlet: M }`

3. **Source worker sends message**:

   - Worker checks local worker connection map
   - Sends via corresponding worker port

4. **Target worker receives message via port**:
   - Routes to message callback with proper metadata

## Files Modified

### 1. `src/lib/messages/DirectChannelService.ts`

```typescript
import { GLSystem } from "$lib/canvas/GLSystem";

export interface DirectConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}

const RENDER_NODE_TYPES = new Set(["canvas", "three", "hydra", "textmode"]);
const WORKER_NODE_TYPES = new Set(["worker"]);

export class DirectChannelService {
  private static instance: DirectChannelService;

  private registeredWorkers = new Map<string, Worker>();
  private workersWithRenderChannels = new Set<string>();
  private workerToWorkerChannels = new Set<string>(); // "sourceId->targetId"
  private edges: Array<{ ... }> = [];
  private nodeTypes = new Map<string, string>();

  static getInstance(): DirectChannelService;

  registerWorker(nodeId: string, worker: Worker): void;
  unregisterWorker(nodeId: string): void;
  updateNodeTypes(nodes: Array<{ id: string; type: string }>): void;
  updateEdges(edges: Array<{ ... }>): void;

  private setupChannelsForWorker(nodeId: string): void;
  private hasRenderConnections(nodeId: string): boolean;
  private getWorkerTargets(nodeId: string): string[];
  private setupRenderChannel(nodeId: string): void;
  private setupWorkerToWorkerChannel(sourceId: string, targetId: string): void;
  private syncConnectionsToWorker(nodeId: string): void;
  private parseHandleIndex(handle?: string | null): number;
}
```

### 2. `src/lib/js-runner/WorkerNodeSystem.ts`

**Changes:**

```typescript
import { DirectChannelService } from "$lib/messages/DirectChannelService";

// In WorkerMessage union type:
export type WorkerMessage =
  | // ... existing types ...
  | { type: "setRenderPort" }
  | { type: "updateRenderConnections"; connections: RenderConnection[] }
  | { type: "setWorkerPort"; targetNodeId?: string; sourceNodeId?: string }
  | { type: "updateWorkerConnections"; connections: RenderConnection[] };

// In create():
async create(nodeId: string): Promise<void> {
  // ... existing worker creation ...
  DirectChannelService.getInstance().registerWorker(nodeId, worker);
}

// In destroy():
destroy(nodeId: string): void {
  // ... existing cleanup ...
  DirectChannelService.getInstance().unregisterWorker(nodeId);
}
```

### 3. `src/workers/js/jsWorker.ts`

**New state in NodeState:**

```typescript
interface NodeState {
  // ... existing fields ...
  renderPort: MessagePort | null;
  renderConnections: RenderConnection[];
  workerPorts: Map<string, MessagePort>; // targetNodeId or sourceNodeId → port
  workerConnections: RenderConnection[];
}
```

**New message handlers:**

```typescript
.with({ type: 'setRenderPort' }, () => {
  const state = getNodeState(nodeId);
  state.renderPort = event.ports[0];
  state.renderPort.start();
})

.with({ type: 'updateRenderConnections' }, (data) => {
  const state = getNodeState(nodeId);
  state.renderConnections = data.connections;
})

.with({ type: 'setWorkerPort' }, (data) => {
  const state = getNodeState(nodeId);
  const { targetNodeId, sourceNodeId } = data;
  const port = event.ports[0];

  if (targetNodeId) {
    // Sending port (we send TO targetNodeId)
    state.workerPorts.set(targetNodeId, port);
    port.start();
  } else if (sourceNodeId) {
    // Receiving port (we receive FROM sourceNodeId)
    state.workerPorts.set(sourceNodeId, port);
    port.onmessage = (e) => {
      const { data: msgData, inlet, inletKey, fromNodeId } = e.data;
      if (state.messageCallback) {
        state.messageCallback(msgData, { source: fromNodeId, inlet, inletKey });
      }
    };
    port.start();
  }
})

.with({ type: 'updateWorkerConnections' }, (data) => {
  const state = getNodeState(nodeId);
  state.workerConnections = data.connections;
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

  // Send directly to worker targets if available
  if (state.workerPorts.size > 0 && state.workerConnections.length > 0) {
    const workerTargets = state.workerConnections.filter(
      (c) => options?.to === undefined || c.outlet === options.to
    );

    for (const target of workerTargets) {
      const port = state.workerPorts.get(target.targetNodeId);
      if (port) {
        port.postMessage({
          fromNodeId: nodeId,
          targetNodeId: target.targetNodeId,
          inlet: target.inlet,
          inletKey: target.inletKey,
          data,
        });
      }
    }
  }

  // Always also send via main thread for non-direct targets
  postResponse({ type: "sendMessage", nodeId, data, options });
};
```

### 4. `src/lib/canvas/GLSystem.ts`

**Methods:**

```typescript
/** Register a worker's render port (called by DirectChannelService). */
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

### 6. Integration (`FlowCanvasInner.svelte`)

```typescript
import { DirectChannelService } from "$lib/messages/DirectChannelService";

let directChannelService = DirectChannelService.getInstance();

// When edges change
$effect(() => {
  directChannelService.updateEdges(edges);
});

// When nodes change
$effect(() => {
  directChannelService.updateNodeTypes(
    nodes
      .filter((n) => n.type !== undefined)
      .map((n) => ({ id: n.id, type: n.type }))
  );
});
```

## Future Extensions

### Adding WASM Worker Support

```typescript
// Future WasmNodeSystem - same pattern
class WasmNodeSystem {
  async create(nodeId: string): Promise<void> {
    const worker = new WasmWorker();
    // ... setup ...

    // Same registration API
    DirectChannelService.getInstance().registerWorker(nodeId, worker);
  }
}
```

The WASM worker implements the same protocol:

- Handle `setRenderPort` to receive the render port
- Handle `setWorkerPort` to receive worker-to-worker ports
- Handle `updateRenderConnections` and `updateWorkerConnections` for connection info
- Use ports to send directly to targets

### Other Future Worker Types

Any worker-based node can use this service:

- Python via Pyodide
- Lua via Fengari
- Custom DSLs compiled to WASM

## Edge Cases

1. **Worker connects to both render and non-render nodes**: Send via both direct and main thread paths
2. **Worker connects to both worker and non-worker nodes**: Same - use direct for worker targets
3. **Connection removed**: Update connection map, keep channel alive for reconnection
4. **Worker destroyed**: Close ports, remove from maps, clean up channel tracking
5. **Render node destroyed**: Render worker ignores unknown target IDs
6. **Target worker not yet registered**: Channel setup deferred until both workers registered

## Testing

1. Connect worker → canvas, verify direct messaging
2. Connect worker → worker, verify direct messaging
3. Connect worker → canvas + js, verify both paths work
4. Connect worker A → worker B → canvas (chain)
5. Disconnect/reconnect, verify channel reuse
6. Delete worker node, verify cleanup
7. Performance: measure latency reduction
8. Multiple workers simultaneously

## Future Optimizations

- Per-connection channels if single render channel becomes bottleneck
- Transferable objects (ArrayBuffer, ImageBitmap) via direct channel
- Bidirectional channels for render→worker or worker←→worker communication
- Channel pooling for frequently reconnecting workers
