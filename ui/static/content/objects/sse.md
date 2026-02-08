Receive real-time events from a server using the
[EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource).

## Usage

`sse https://example.com/events` to create a node with a pre-filled URL.

Example: `sse https://stream.wikimedia.org/v2/stream/recentchange` streams
changes to wiki.

## Behavior

- Auto-connects on load if a URL is configured
- Messages are automatically parsed as JSON if possible, otherwise sent as
  raw strings

## See Also

- [mqtt](/docs/objects/mqtt) - MQTT pub/sub
- [netsend](/docs/objects/netsend) - P2P network messaging
