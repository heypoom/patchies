Send messages across the network.

![Patchies netsend/netrecv demo](/content/images/irc-netrecv.webp)

> Try this patch [in the app](/?id=pdfb7c8skxk4qw4s)!
> Chat over the network - click "Share Link" and send to a friend!

## Usage

Type `netsend <channelname>` to create a sender, e.g. `netsend chat`.

Send messages into the inlet to broadcast on that channel.

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

- [netrecv](/docs/objects/netrecv) - receive network messages
- [mqtt](/docs/objects/mqtt) - MQTT messaging
