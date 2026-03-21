Send DMX-512 lighting control data over WebSerial.

The `dmx` node is hardcoded to the DMX-512 serial specification (250000 baud, 8 data bits, 2 stop bits, no parity) and handles BREAK framing automatically. Send a channel array to trigger a frame.

## Setup

1. Create the node and click the gear icon (or the node body)
2. Click **Request Port** to open the browser's serial port picker
3. Select your USB-to-DMX adapter

## Sending Channels

Send a `number[]` or `Uint8Array` of up to 512 values (0–255) to the inlet. The node pads shorter arrays to 512 channels and sends a full DMX frame immediately.

```javascript
// From a js node — continuous loop at 25fps
const channels = new Array(512).fill(0);
channels[0] = 255; // fixture channel 1

setInterval(() => send(channels), 40);

onCleanup(() => send({ type: 'blackout' }));
```

## Continuous Sending

DMX fixtures go dark if they stop receiving frames. Use `setInterval` in a connected `js` node to keep sending the last frame at a regular interval (~25–40fps).

## See Also

- [serial](/docs/objects/serial) — general-purpose WebSerial with configurable settings
- [serial.term](/docs/objects/serial.term) — interactive serial terminal
