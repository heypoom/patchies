# P2P Messaging

Use `netsend` and `netrecv` to send and receive messages over peer-to-peer WebRTC connections.

## Room Configuration

When you create a [netsend](/docs/objects/netsend) or [netrecv](/docs/objects/netrecv) object, Patchies adds a `room` parameter to the URL. Users need the same `?room=` parameter to connect.

- **Remove the room parameter** from the URL to create a different room.
- **Set a room manually** with `Ctrl/Cmd + K > Set room for netsend/netrecv`.
- **Share a room** with "Share Link" or `Ctrl/Cmd + K > Share Patch Link`. Patchies adds the room to the shared link.

## How It Works

Patchies uses [Trystero](https://github.com/dmotz/trystero) and [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API). Public relay servers help peers find each other. No central server stores messages.

## Node.js and Bun Integration

Use [Trystero](https://github.com/dmotz/trystero) to send and receive messages from Node.js or Bun scripts. Use an RTC polyfill such as `node-datachannel/polyfill` or `werift`.

### OSC Bridge Example

Route messages from `netsend osc` to a local OSC server:

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

Control DMX-enabled equipment with `netsend dmx`:

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

- [netsend](/docs/objects/netsend) — Send network messages.
- [netrecv](/docs/objects/netrecv) — Receive network messages.
- [mqtt](/docs/objects/mqtt) — Send and receive MQTT messages.
