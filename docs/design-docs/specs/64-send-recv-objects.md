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

## Architecture: ChannelRegistry

Central singleton that manages named channel subscriptions and routing.

```txt
ChannelRegistry (new singleton in src/lib/messages/)
├── messageChannels: Map<channel, {senders: Set<nodeId>, receivers: Set<nodeId>}>
├── audioChannels: Map<channel, {senders: Set<nodeId>, receivers: Set<nodeId>}>
├── videoChannels: Map<channel, {senders: Set<nodeId>, receivers: Set<nodeId>}>
│
├── subscribe(channel, nodeId, role: 'send' | 'recv', type)
├── unsubscribe(channel, nodeId, type)
│
├── broadcast(channel, message, type: 'message')  // Direct delivery for messages
├── getAudioVirtualEdges() → Edge[]               // Virtual edges for audio
└── getVideoVirtualEdges() → Edge[]               // Virtual edges for video
```

### Routing Approaches by Type

**Messages: Direct Broadcast**

- `send` node / JS `send()` calls `ChannelRegistry.broadcast(channel, message)`
- ChannelRegistry looks up all receivers and delivers directly
- No virtual edges needed - simpler and more direct

**Audio & Video: Virtual Edges**

- ChannelRegistry generates virtual edges for send→recv pairs
- AudioService / GLSystem merge virtual edges with real edges
- Existing connection logic handles the actual routing

### Fan-out Behavior

When multiple receivers listen to the same channel:

- **Messages**: Broadcast to all receivers (direct delivery)
- **Audio**: Web Audio default behavior (signal summing)
- **Video**: Same frame reference sent to all receivers

## Node Implementations

### Message: `send` / `recv`

```txt
┌─────────────┐          ┌─────────────┐
│  send foo   │          │  recv foo   │
├─────────────┤          ├─────────────┤
│ ● inlet     │  ~~~~>   │   outlet ● │
└─────────────┘          └─────────────┘
```

- `send`: Single message inlet, no outlet
- `recv`: Single message outlet, no inlet (hot - fires immediately when message arrives)
- Channel name from first argument
- Routes via `ChannelRegistry.broadcast()`

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

---

## Implementation Plan

### Phase 1: Message (`send` / `recv`)

1. **Create ChannelRegistry** (`src/lib/messages/ChannelRegistry.ts`)
   - Singleton with `messageChannels` map
   - `subscribe(channel, nodeId, role, type)`
   - `unsubscribe(channel, nodeId, type)`
   - `broadcast(channel, message)` - delivers to all receivers

2. **Create visual objects**
   - `SendNode.svelte` - inlet only, calls `ChannelRegistry.broadcast()` on message
   - `RecvNode.svelte` - outlet only, registers as receiver, fires on broadcast
   - Register in `node-types.ts`, `defaultNodeData.ts`
   - Add to `get-categorized-objects.ts` with descriptions
   - Set `shorthand: true` with aliases `s` / `r`

3. **JavaScript API**
   - Update `send()` in JSRunner to accept `{ channel: string }` option
   - Update `recv()` in JSRunner to accept `{ channel: string }` option
   - Same for worker context, hydra context, etc.

4. **Cleanup**
   - On node delete, call `ChannelRegistry.unsubscribe()`

### Phase 2: Audio (`send~` / `recv~`)

1. **Extend ChannelRegistry**
   - Add `audioChannels` map
   - Add `getAudioVirtualEdges()` method

2. **Create audio nodes** (V2 pattern)
   - `SendAudioNode` - audio inlet, registers as sender
   - `RecvAudioNode` - audio outlet, pass-through GainNode
   - Set `shorthand: true` with aliases `s~` / `r~`

3. **Integrate with AudioService**
   - Merge virtual edges in `updateEdges()`

### Phase 3: Video (`send.vdo` / `recv.vdo`)

1. **Extend ChannelRegistry**
   - Add `videoChannels` map
   - Add `getVideoVirtualEdges()` method

2. **Create video nodes**
   - `SendVdoNode` - video inlet, registers as sender
   - `RecvVdoNode` - video outlet, passes through FBO
   - Set `shorthand: true` with aliases `sv` / `rv`

3. **Integrate with GLSystem / fboRenderer**
   - Merge virtual edges in render graph topology
