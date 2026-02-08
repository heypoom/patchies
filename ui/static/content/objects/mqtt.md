Connect to MQTT brokers over WebSocket for pub/sub messaging with IoT devices,
home automation systems, or other MQTT-enabled services.

![Patchies MQTT demo](/content/images/mqtt-demo.webp)

> Try this patch [in the app](https://patchies.app/?id=oc460hxe5cqgk56)!

## Setup

1. Type `mqtt` in the object box to create the node
2. Click the gear icon to configure
3. Enter a WebSocket broker URL (e.g., `wss://test.mosquitto.org:8081/mqtt`)
4. Click Connect
5. Add topics to subscribe to

Use the "Random" button to try public test brokers.

## Security Note

Broker URLs are not saved with the patch (they may contain credentials).
Topics are saved.

Use `loadbang` with `{type: 'connect', url}` to auto-connect after patch load.

## See Also

- [sse](/docs/objects/sse) - Server-Sent Events
- [netsend](/docs/objects/netsend) - P2P network messaging
