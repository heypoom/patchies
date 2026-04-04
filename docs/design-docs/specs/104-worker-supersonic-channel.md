# 104. Worker SuperSonic Channel

## Overview

Add `getSuperSonicChannel()` as a global async function in the Worker object. This allows worker nodes to send OSC messages directly to the SuperSonic AudioWorklet without routing through the main thread, enabling low-latency sequencers and MIDI processing in workers.

## API

```js
// In a worker node:
const channel = await getSuperSonicChannel()

// Send OSC messages directly to scsynth
channel.send(oscBytes)
channel.sendDirect(oscBytes)
channel.close()
```

## Architecture

### Flow

1. User code calls `getSuperSonicChannel()` in worker
2. Worker sends `requestSuperSonicChannel` message to main thread
3. Main thread calls `SuperSonicManager.ensureSuperSonic()` (lazy loads SuperSonic if needed)
4. Main thread calls `sonic.createOscChannel()` to create a transferable channel
5. Main thread transfers the channel to the worker via `postMessage` with transfer list
6. Worker dynamically imports `supersonic-scsynth` and calls `OscChannel.fromTransferable(data)`
7. Promise resolves with the `OscChannel` instance

### Message Protocol

**Worker -> Main**: `{ type: 'requestSuperSonicChannel', requestId: string }`

**Main -> Worker**: `{ type: 'superSonicChannelReady', requestId: string, channel?: transferable, error?: string }` (with transfer list)

### Cleanup

Channels are tracked per-node and closed on cleanup (code re-execution or node destruction).
