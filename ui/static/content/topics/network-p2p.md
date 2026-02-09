# P2P Messaging

Use `netsend` and `netrecv` to send and receive messages across the network using peer-to-peer WebRTC connections.

## Room Configuration

When you first create a [netsend](/docs/objects/netsend) or [netrecv](/docs/objects/netrecv) object, a `room` parameter is added to your URL. Users need the same `?room=` parameter to connect to each other.

- **Remove the room parameter** from your URL to generate a different room
- **Set manually**: Go to `Ctrl/Cmd + K > Set room for netsend/netrecv`
- **Share with friends**: Use "Share Link" (or `Ctrl/Cmd + K > Share Patch Link`) to automatically include the room in shared links

## How It Works

Uses [Trystero](https://github.com/dmotz/trystero) and [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) with public relay servers for peer-to-peer mesh discovery. No central server stores your messages.

## Node.js/Bun Integration

You can send and receive messages from your own Node.js or Bun scripts using [Trystero](https://github.com/dmotz/trystero) with RTC polyfills like `node-datachannel/polyfill` or `werift`.

### OSC Bridge Example

Route messages from `netsend osc` to your local OSC server:

```ts
import { joinRoom } from "trystero";
import { Client } from "node-osc";
import { RTCPeerConnection } from "node-datachannel/polyfill";

const appId = "patchies";
const roomId = "f84df292-3811-4d9b-be54-ce024d4ae1c0"; // your room id!

const room = joinRoom({ appId, rtcPolyfill: RTCPeerConnection }, roomId);
const [netsend, netrecv] = room.makeAction("osc");
const osc = new Client("127.0.0.1", 3333);

room.onPeerJoin((peerId) => console.log("peer joined:", peerId));
room.onPeerLeave((peerId) => console.log("peer left:", peerId));

netrecv((data) => {
  const { address, args } = data;

  osc.send(address, ...args, (err) => {
    if (err) console.error(err);
    netsend("osc sent!");
    osc.close();
  });
});
```

### ArtNet DMX Bridge Example

Control DMX-enabled equipment via `netsend dmx`:

```ts
import { joinRoom } from "trystero";
import { RTCPeerConnection } from "node-datachannel/polyfill";
import dmxlib from "dmxnet";

const appId = "patchies";
const roomId = "f84df292-3811-4d9b-be54-ce024d4ae1c0"; // your room id!

const room = joinRoom({ appId, rtcPolyfill: RTCPeerConnection }, roomId);

room.onPeerJoin((peerId) => console.log("peer joined:", peerId));
room.onPeerLeave((peerId) => console.log("peer left:", peerId));

const [netsend, netrecv] = room.makeAction("dmx");

const dmxnet = new dmxlib.dmxnet({});
const sender = dmxnet.newSender({
  ip: "127.0.0.1",
  subnet: 0,
  universe: 0,
  port: 6454,
});

netrecv((data, peerId) => {
  if (Array.isArray(data)) {
    for (let frame of data) {
      sender.prepChannel(frame.channel, frame.value);
    }

    sender.transmit();
  }
});
```

## See Also

- [netsend](/docs/objects/netsend) - send network messages
- [netrecv](/docs/objects/netrecv) - receive network messages
- [mqtt](/docs/objects/mqtt) - MQTT messaging
