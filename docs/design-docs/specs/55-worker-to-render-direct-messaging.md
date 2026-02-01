# 55. Worker-to-Render Direct Messaging

## Overview

Bypass the main thread when sending messages from `worker` nodes to FBO-enabled render nodes (`canvas`, `three`, `hydra`, `textmode`).

**Current flow:**

```
Worker (web worker) → Main Thread (MessageSystem) → Render Worker
```

**New flow:**

```
Worker (web worker) → [MessageChannel] → Render Worker
```

## Design Decisions

| Decision         | Choice                                                   |
| ---------------- | -------------------------------------------------------- |
| Channel topology | Single shared channel per worker node to render worker   |
| Outlet filtering | Filter in worker node (worker knows its own connections) |
| Channel setup    | Lazy - only on first worker→render edge                  |

## Architecture

### Message Flow

1. When first worker→render edge is created:
   - Main thread creates `MessageChannel`
   - `port1` transferred to worker node's web worker
   - `port2` transferred to render worker

2. When edges change:
   - Main thread computes filtered connection graph (worker→render only)
   - Syncs to worker node: `{ outlet: N, targetNodeId: 'xyz', inlet: M }`

3. When worker calls `send(data, { to: N })`:
   - Worker checks local connection map
   - If outlet N connects to render node(s), send via render port
   - Otherwise, fall through to main thread routing (for non-render targets)

4. When render worker receives message via port:
   - Dispatch to `FBORenderer.sendMessageToNode(targetNodeId, message)`

## Files to Modify

### 1. `src/lib/js-runner/WorkerNodeSystem.ts`

**New state:**

```typescript
// Track which workers have render ports set up
private workersWithRenderPorts = new Set<string>();

// Store edges for computing render connections
private allEdges: Edge[] = [];
```

**New methods:**

```typescript
// Called when edges change - detect new worker→render connections
updateEdgesForRenderConnections(edges: Edge[]): void

// Set up MessageChannel for a worker node
private setupRenderChannel(nodeId: string): void

// Compute and sync render connections to a worker
private syncRenderConnectionsToWorker(nodeId: string): void
```

**Modified methods:**

- `destroy()` - clean up render port state

### 2. `src/workers/js/jsWorker.ts`

**New state in NodeState:**

```typescript
interface NodeState {
  // ... existing fields ...
  renderPort: MessagePort | null;
  renderConnections: Array<{ outlet: number; targetNodeId: string; inlet: number }>;
}
```

**New message handlers:**

```typescript
// Receive render port from main thread
.with({ type: 'setRenderPort' }, (data, transfer) => { ... })

// Receive connection updates
.with({ type: 'updateRenderConnections' }, (data) => { ... })
```

**Modified `send()` function:**

```typescript
const send = (data: unknown, options?: { to?: number }) => {
  const state = getNodeState(nodeId);

  // Check if this outlet connects to any render nodes
  const renderTargets = state.renderConnections.filter(
    (c) => options?.to === undefined || c.outlet === options.to
  );

  if (renderTargets.length > 0 && state.renderPort) {
    // Send directly to render worker
    for (const target of renderTargets) {
      state.renderPort.postMessage({
        targetNodeId: target.targetNodeId,
        inlet: target.inlet,
        data
      });
    }
  }

  // Also send via main thread for non-render targets
  // (MessageSystem will filter based on actual connections)
  postResponse({ type: 'sendMessage', nodeId, data, options });
};
```

### 3. `src/lib/canvas/GLSystem.ts`

**New state:**

```typescript
// Store ports for each worker node (port2 side)
private workerPorts = new Map<string, MessagePort>();
```

**New methods:**

```typescript
// Receive port from WorkerNodeSystem and transfer to render worker
registerWorkerPort(nodeId: string, port: MessagePort): void

// Clean up when worker is destroyed
unregisterWorkerPort(nodeId: string): void
```

### 4. `src/workers/rendering/renderWorker.ts`

**New state:**

```typescript
// Map of worker nodeId → MessagePort
const workerPorts = new Map<string, MessagePort>();
```

**New message handlers:**

```typescript
.with('registerWorkerPort', () => {
  // Store port and set up message listener
  const port = event.ports[0];
  workerPorts.set(data.nodeId, port);

  port.onmessage = (e) => {
    // Route to FBORenderer
    fboRenderer.sendMessageToNode(e.data.targetNodeId, {
      data: e.data.data,
      inlet: e.data.inlet,
      // ... other message fields
    });
  };
})

.with('unregisterWorkerPort', () => {
  const port = workerPorts.get(data.nodeId);
  if (port) {
    port.close();
    workerPorts.delete(data.nodeId);
  }
})
```

### 5. Type definitions

**New types in `WorkerNodeSystem.ts`:**

```typescript
export type WorkerMessage = { nodeId: string } &
  // ... existing types ...
  (| { type: 'setRenderPort' } // port transferred via transfer list
    | { type: 'updateRenderConnections'; connections: RenderConnection[] }
  );

interface RenderConnection {
  outlet: number;
  targetNodeId: string;
  inlet: number;
  inletKey?: string;
}
```

## Implementation Steps

### Phase 1: Channel Setup Infrastructure

1. Add `workersWithRenderPorts` Set to WorkerNodeSystem
2. Add `workerPorts` Map to GLSystem
3. Add port registration handlers to renderWorker.ts
4. Add `setRenderPort` handler to jsWorker.ts

### Phase 2: Connection Detection & Sync

1. Add helper to detect render node types (canvas, three, hydra, textmode)
2. Add `updateEdgesForRenderConnections()` to WorkerNodeSystem
3. Implement `syncRenderConnectionsToWorker()`
4. Add `updateRenderConnections` handler to jsWorker.ts

### Phase 3: Message Routing

1. Modify `send()` in jsWorker.ts to check render connections
2. Add port message handler in renderWorker.ts to route to FBORenderer
3. Ensure message format matches what FBORenderer expects

### Phase 4: Cleanup

1. Clean up ports when worker node is destroyed
2. Update connections when edges are removed
3. Handle edge cases (node deleted while message in flight)

## Edge Cases

1. **Worker connects to both render and non-render nodes**: Send via both paths (render port + main thread)
2. **Connection removed**: Update worker's connection map, but don't tear down channel (may reconnect)
3. **Worker destroyed**: Close port, remove from maps
4. **Render node destroyed**: Worker's send() will fail silently (render worker ignores unknown targets)

## Testing

1. Connect worker → canvas, verify messages arrive without main thread routing
2. Connect worker → canvas + js node, verify both receive messages
3. Disconnect and reconnect, verify channel reuse
4. Delete worker node, verify cleanup
5. Performance test: measure latency reduction

## Future Optimizations

- Per-connection channels if single shared channel becomes bottleneck
- Transferable objects (ArrayBuffer, ImageBitmap) via the direct channel
- Bidirectional channel for render→worker communication
