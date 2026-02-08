# 64. Named Channels for Send/Recv Objects

## Problem

Connecting distant nodes with visual cords creates spaghetti patches. Named channels allow wireless routing between nodes without visual connections.

There are three types of data to transfer:

- **Messages** - events, bangs, data objects
- **Audio** - Web Audio signals
- **Video** - FBO/texture frames

We already have networked variants (`netsend/netrecv`, `vdo.ninja.pull/push`) but these require real network connections. We need local named channels for cleaner patches.

## Design: Separate Objects Per Type

Each data type gets its own send/recv object pair, routed by its respective system:

| Data Type | Full Name                         | Shorthand             | Routed By     |
| --------- | --------------------------------- | --------------------- | ------------- |
| Message   | `send <ch>` / `recv <ch>`         | `s <ch>` / `r <ch>`   | MessageSystem |
| Audio     | `send~ <ch>` / `recv~ <ch>`       | `s~ <ch>` / `r~ <ch>` | AudioService  |
| Video     | `send.vdo <ch>` / `recv.vdo <ch>` | `sv <ch>` / `rv <ch>` | GLSystem      |

All objects have `shorthand: true` in their definition (like the `trigger` object).

### Why Separate Objects?

- **No type detection needed** - each object maps 1:1 to a routing system
- **Clear intent** - no ambiguity about what data flows through
- **Follows conventions** - `~` suffix for audio matches Max/PD tradition
- **Simpler implementation** - no dynamic port visibility or type flags

## Architecture: Virtual Edges

Named channels work by generating **virtual edges** that each routing system consumes alongside real edges.

```txt
ChannelRegistry (new singleton)
├── audioChannels: Map<channel, {senders: Set<nodeId>, receivers: Set<nodeId>}>
├── messageChannels: Map<channel, {senders: Set<nodeId>, receivers: Set<nodeId>}>
├── videoChannels: Map<channel, {senders: Set<nodeId>, receivers: Set<nodeId>}>
│
├── subscribe(channel, nodeId, role: 'send' | 'recv', type: 'audio' | 'message' | 'video')
├── unsubscribe(channel, nodeId, type)
│
├── getAudioVirtualEdges() → Edge[]
├── getMessageVirtualEdges() → Edge[]
└── getVideoVirtualEdges() → Edge[]
```

### Integration with Existing Systems

Each system merges virtual edges with real edges:

```ts
// In AudioService.updateEdges()
const allEdges = [...realEdges, ...ChannelRegistry.getAudioVirtualEdges()];

// In MessageSystem
const allEdges = [...realEdges, ...ChannelRegistry.getMessageVirtualEdges()];

// In GLSystem / fboRenderer
const allEdges = [...realEdges, ...ChannelRegistry.getVideoVirtualEdges()];
```

### Fan-out Behavior

When multiple receivers listen to the same channel:

- **Messages**: Broadcast to all receivers
- **Audio**: Web Audio default behavior (signal summing)
- **Video**: Same frame reference sent to all receivers

## Node Implementations

### Message: `send` / `recv`

```txt
┌─────────────┐          ┌─────────────┐
│  send foo   │          │  recv foo   │
├─────────────┤          ├─────────────┤
│ ● message  │  ~~~~>   │  message ● │
└─────────────┘          └─────────────┘
```

- Single message inlet/outlet
- Routes through MessageSystem
- Channel name from first argument

### Audio: `send~` / `recv~`

```txt
┌─────────────┐          ┌─────────────┐
│  send~ foo  │          │  recv~ foo  │
├─────────────┤          ├─────────────┤
│ ● audio    │  ~~~~>   │   audio ●  │
└─────────────┘          └─────────────┘
```

- Single audio inlet/outlet
- `recv~` is a pass-through GainNode (gain=1)
- Virtual edge triggers `AudioNode.connect()` calls

### Video: `send.vdo` / `recv.vdo`

```txt
┌─────────────┐          ┌─────────────┐
│ send.vdo foo│          │recv.vdo foo │
├─────────────┤          ├─────────────┤
│ ● video    │  ~~~~>   │   video ●  │
└─────────────┘          └─────────────┘
```

- Single video inlet/outlet
- Virtual edge affects render graph topology
- `recv.vdo` passes through the FBO texture

## JavaScript API Integration

Extend existing `send()` and `recv()` functions with optional channel parameter:

```ts
// Send to named channel (works with visual recv nodes)
send({ type: "bang" }, { channel: "foo" });

// Receive from named channel (works with visual send nodes)
recv((m) => console.log(m), { channel: "foo" });
```

This makes JavaScript code and visual objects interoperable on the same channel.

### Worker Integration

For worker nodes (`js.worker`), integrate with `DirectChannelService`:

- When a `send` node targets a channel with worker `recv` subscribers, set up MessageChannel connections dynamically
- ChannelRegistry notifies DirectChannelService of channel membership changes

## Cleanup

When a send/recv node is deleted:

1. Unsubscribe from ChannelRegistry
2. Virtual edges automatically disappear
3. Each system's next `updateEdges()` call removes the stale connections

## Future Considerations

- **Channel namespacing**: Currently global. Could add subpatch-local channels later (e.g., `---foo` prefix like Max)
- **Channel inspection**: UI to show all active channels and their subscribers
