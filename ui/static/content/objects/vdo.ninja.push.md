Push audio, video, and messages to a [VDO.Ninja](https://vdo.ninja) room
over WebRTC.

![Patchies VDO.Ninja loopback demo](/content/images/vdo-ninja-loopback.webp)

> Try this patch [in the app](/?id=nahfiov94it8bxr&readonly=true)!

## Settings

- **Stream ID**: identifier for your stream (viewers use this to pull)
- **Room Name**: the VDO.Ninja room to join
- **Data Only**: toggle to disable video/audio (mesh networking for messages)

At least one of stream ID or room name is required. You can specify both.

## Inlets

- **Message inlet**: send data to peers, or control commands
- **Video inlet**: video signal to stream (hidden in data-only mode)
- **Audio inlet**: audio signal to stream (hidden in data-only mode)

## See Also

- [vdo.ninja.pull](/docs/objects/vdo.ninja.pull) - pull from VDO.Ninja
- [netsend](/docs/objects/netsend) - P2P network messaging
