Receive messages from the network.

## Usage

Type `netrecv <channelname>` to create a receiver, e.g. `netrecv chat`.

Messages from that channel will flow out of the outlet.

## Room

When you first create a `netsend` or `netrecv`, a `room` parameter is added to
your URL. Users need the same `?room=` parameter to connect.

- Remove the `room` parameter to generate a different room
- Go to `Ctrl/Cmd + K > Set room for netsend/netrecv` to set manually
- Use "Share Link" to automatically include the room in shared links

## How It Works

Uses [Trystero](https://github.com/dmotz/trystero) and WebRTC with public relay
servers for peer-to-peer mesh discovery.

## Node.js/Bun Integration

Send and receive messages from your own scripts using Trystero with RTC polyfills like `node-datachannel/polyfill` and `werift`.

## See Also

- [netsend](/docs/objects/netsend) - send network messages
- [mqtt](/docs/objects/mqtt) - MQTT messaging
