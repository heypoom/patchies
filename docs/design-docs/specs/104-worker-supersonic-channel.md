# 104. SuperSonic OscChannel in Workers and AudioWorklets

## Overview

Add `getSuperSonicChannel()` as a global async function in Worker and DSP~ nodes. This allows worker and AudioWorklet code to send OSC messages directly to the SuperSonic AudioWorklet without routing through the main thread, enabling low-latency sequencers and MIDI processing.

## API

### Worker

```js
const { channel, osc } = await getSuperSonicChannel()

const oscBytes = osc.encodeMessage('/s_new', ['default', -1, 0, 0])
channel.send(oscBytes)
```

Returns `{ channel, osc }` — both the OscChannel and the osc encoder.

### DSP~ (AudioWorklet)

```js
getSuperSonicChannel().then(({ channel }) => {
  // channel.send(oscBytes)
})
```

Returns `{ channel }` only — the `osc` encoder is not available in AudioWorkletGlobalScope (the slim `supersonic-scsynth/osc-channel` entry point doesn't include it).

Key differences from worker usage:
- Channel created with `blocking: false` (audio thread can't use `Atomics.wait()`)
- Uses `supersonic-scsynth/osc-channel` slim entry point (no DOM/Worker deps)
- User code is synchronous — use `.then()` instead of `await`

## Architecture

### Flow (Worker)

1. User code calls `getSuperSonicChannel()` in worker
2. Worker sends `requestSuperSonicChannel` message to main thread
3. Main thread calls `SuperSonicManager.ensureSuperSonic()` (lazy loads if needed)
4. Main thread calls `sonic.createOscChannel()` to create a transferable channel
5. Main thread transfers the channel to the worker via `postMessage` with transfer list
6. Worker dynamically imports `supersonic-scsynth` and calls `OscChannel.fromTransferable(data)`
7. Promise resolves with `{ channel, osc }`

### Flow (DSP~)

1. User code calls `getSuperSonicChannel()` in processor
2. Processor sends `request-supersonic-channel` to DspNode via port
3. DspNode calls `SuperSonicManager.ensureSuperSonic()` (lazy loads if needed)
4. DspNode calls `sonic.createOscChannel({ blocking: false })`
5. DspNode transfers the channel to the processor via `port.postMessage` with transfer list
6. Processor calls `OscChannel.fromTransferable(data)` (statically imported slim entry)
7. Promise resolves with `{ channel }`

### Message Protocol

**Worker → Main**: `{ type: 'requestSuperSonicChannel', requestId }`
**Main → Worker**: `{ type: 'superSonicChannelReady', requestId, channel?, error? }` (+ transfer list)

**DSP~ Processor → Main**: `{ type: 'request-supersonic-channel', requestId }`
**Main → DSP~ Processor**: `{ type: 'supersonic-channel-ready', requestId, channel?, error? }` (+ transfer list)

### Cleanup

Channels are tracked per-node and closed on cleanup (code re-execution or node destruction).
