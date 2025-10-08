# 44. Revamped sampler~ node ✅

**Status**: Implemented

Let's revamp the sampler~ node:

- It should display a waveform of the sampled signal.
- It should retain the existing action buttons: **record** and **play**
- It should let users define the start and end points of the sample.
  - It should store playback start and end points in the node data.
  - It should store loop state in the node data
  - ...so we can display both in the UI.
- It should have a settings menu (like `chuck~`)
  - Configure start and end points
  - Configure loop or no loop

## Messages

Keep existing messages and add these:

- `{ type: 'loop' }` should have both start and end as `P.optional`
  - if `loopStart` and `loopEnd` was defined previously in `AudioBufferSourceNode`, use those values.
  - if not, don't set the loop values and use the default.
- `{ type: 'setStart', value: number }` - sets the playback start point of the sample.
  - This should also set the `loopStart` property
- `{ type: 'setEnd', value: number }` - sets the playback end point of the sample.
  - This should also set the `loopEnd` property

## Files to modify

- `SamplerNode.svelte`
- `AudioSystem.svelte`
