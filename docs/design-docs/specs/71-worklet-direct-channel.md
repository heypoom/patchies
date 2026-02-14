# 71. Worklet Direct Channel

Direct message passing between AudioWorklet processors, bypassing the main thread.

## Problem

When two worklet nodes are connected (e.g., `bang~` -> `snapshot~`), messages currently route through the main thread:

```
processor send() -> port.postMessage -> main thread MessageSystem -> port.postMessage -> processor recv()
```

This adds ~2 thread hops + MessageSystem routing overhead per message, at up to ~344 msgs/sec per process() call.

## Solution

All AudioWorkletProcessors share one `AudioWorkletGlobalScope` (single AudioContext). A shared global registry allows processors to call each other's `recv()` directly — synchronous, zero-copy, zero-latency.

## Architecture

### Worklet Side: `worklet-channel.ts`

A global registry (`globalThis.__workletChannel`) shared across all separately-bundled processor modules:

- **register(nodeId, recv)**: Processor registers itself with its recv callback
- **unregister(nodeId)**: Cleanup on stop
- **updateConnections(nodeId, connections)**: Main thread sends connection updates via port
- **send(sourceNodeId, message, outlet)**: Tries direct delivery first, returns delivered targetNodeIds

### Main Thread: `WorkletDirectChannelService`

Singleton service that:

1. Tracks which nodeIds are worklet-based (have registered ports)
2. When edges change, computes worklet-to-worklet connections
3. Sends `update-direct-connections` messages to each source processor
4. Provides `getDirectTargets()` for building `excludeTargets`

### Message Flow (with direct channel)

```
bang~ process():
  send(msg, 0)
    -> workletChannel.send(nodeId, msg, 0)
       -> finds snapshot~ in registry
       -> calls snapshot~.recv(msg, inlet) synchronously
       -> returns ['snapshot-id']
    -> port.postMessage({ type: 'send-message', msg, outlet: 0, directTargets: ['snapshot-id'] })

Main thread receives:
  messageSystem.sendMessage(nodeId, msg, { to: 0, excludeTargets: ['snapshot-id'] })
    -> skips snapshot~ (already delivered)
    -> delivers to any non-worklet targets normally
```

## Supported Processors

| Processor | Send | Recv | Notes |
|-----------|------|------|-------|
| `defineDSP` (bang~, snapshot~, line~, etc.) | Yes | Yes | Full support |
| `dsp-processor` (dsp~) | Yes | Yes | Full support |
| `expression-processor` (expr~) | No | No | No message passing, skip for now |

## Key Design Decisions

- **`globalThis` singleton**: Each processor file is bundled separately by Vite. The first to load creates the registry; others reuse it via `globalThis.__workletChannel`.
- **`processorOptions`**: Used to pass `nodeId` from main thread into processor constructors. Both `dsp-processor.ts` and `define-dsp.ts` read `processorOptions.nodeId` in their constructors to identify themselves for direct-channel registration.
- **`excludeTargets`**: Already exists in `SendMessageOptions` and `MessageSystem.sendMessage()`. No changes needed to MessageSystem.
- **Always send to main thread**: Processors always post to main thread too (for non-worklet targets). The `directTargets` array tells the main thread which targets to skip.
