# 90. sampler~ download message

**Status**: Implemented

Add a `{ type: 'download', name?: string }` message to `sampler~` that encodes the current audio buffer as a WAV file and triggers a browser download.

## Message

- `{ type: 'download' }` — downloads buffer as `recording.wav`
- `{ type: 'download', name: 'my-sound' }` — downloads as `my-sound.wav` (`.wav` appended if missing)

## UI

Add a download button (cloud-download icon) in the top action bar, visible when a recording exists and not currently recording. Clicking it calls the same download handler.

## Implementation

- `sampler.ts` — add `Download` TypeBox schema and add to `samplerMessages` + inlet list
- `SamplerNode.svelte` — inline `encodeWav(AudioBuffer)` helper, `downloadBuffer(name?)` function, message handler, and download button
