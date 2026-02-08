# 64. Named channels for send/recv objects and parameters

## Problem

I want to send messages to objects that are so far apart in the patch visually. The patch coords becomes so noisy.

There are multiple types of things I might want to transfer over:

- messages
- audio
- video

We already have `netsend <channel>` and `netrecv <channel>` that can do this for networked messages, as well as `vdo.ninja.pull` and `vdo.ninja.push` that can do this for message, video and audio. Both are more complex as they require real network connection, though.

## Design Idea: Named Channels

Let's create a `send <channel>` and `recv <channel>` visual object that can send and receive message, audio and video information.

### Design Considerations

- Do we only allow setting one `type` (e.g. `type: 'message' | 'audio' | 'video'`) and we should only ONE inlet?
  - Or we just show all three inlets/outlets together? Maybe with a `types: {message: false, audio: false, video: false}` that allows showing/hiding multiple ports? Maybe defaults to `message` but can check more to enable more inlets/outlets dynamically?

## Design Idea: Named channels in JavaScript `send/recv` methods

Another supporting idea is to support the second argument for both `send` and `recv`:

- `send({type: 'bang'}, { channel: '<channel>' })` and `recv(m => {}, { channel: '<channel>' })` lets you send
- We should use the same `channel` system for both `send/recv` visual object. Then, this makes both visual object and JavaScript's channels interoperable.
