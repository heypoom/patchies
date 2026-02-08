Pull audio, video, and messages from a [VDO.Ninja](https://vdo.ninja) room
over WebRTC.

## Settings

- **Room Name**: the VDO.Ninja room to join
- **Stream ID to View**: the stream ID to pull from (required in normal mode)
- **Data Only**: toggle to disable video/audio (mesh networking for messages)

## Outlets

- **Message outlet**: events and received data from peers
- **Video outlet**: video from remote stream (hidden in data-only mode)
- **Audio outlet**: audio from remote stream (hidden in data-only mode)

## Data-Only Mode

In data-only mode, you don't need a stream ID - all peers in the room can
exchange messages via mesh networking.

In normal mode (with video/audio), you need to specify which stream to view.

## See Also

- [vdo.ninja.push](/docs/objects/vdo.ninja.push) - push to VDO.Ninja
- [netrecv](/docs/objects/netrecv) - receive P2P messages
