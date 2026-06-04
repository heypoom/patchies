Route named message, audio, and video channels with a compact text patchbay.

## Usage

```text
patchbay
```

`patchbay` routes message, audio, and video channels.

## How It Works

`patchbay` is for channels, not object titles. A name in a route must be either:

1. Declared with `chan` inside the matching section
2. An existing message channel from `send`, `recv`, or JavaScript `send()` / `recv()` channel usage
3. An existing audio channel from `send~` or `recv~`
4. An existing video channel from `send.vdo` or `recv.vdo`
5. An explicit object id written with `obj`, such as `obj slider-43`

```text
[Message]
chan Logger

Clock -> Logger
Logger -> Lights
```

This forwards messages from `Clock` to `Logger`, then from `Logger` to `Lights`.

You can also route directly between object ids:

```text
[Message]
obj slider-43 -> obj peek-44
obj expr-2 -> obj peek-45
```

`obj node-id` uses the first compatible message outlet or inlet for the route direction. Use `obj node-id:1` for the second compatible message port.

## Example

Create these objects anywhere in your patch:

```text
send Clock
recv Lights
patchbay
```

Edit the patchbay code:

```text
[Message]
chan Logger

Clock -> Logger -> Lights
```

Messages sent to `Clock` will pass through the virtual `Logger` channel and arrive at `Lights`.

## Audio Example

Create these objects anywhere in your patch:

```text
send~ Mic
recv~ Out
patchbay
```

Edit the patchbay code:

```text
[Audio]
chan Reverb

Mic -> Reverb -> Out
```

Audio sent to `Mic` will pass through the virtual `Reverb` channel and arrive at `Out`.

## Video Example

Create these objects anywhere in your patch:

```text
send.vdo Camera
recv.vdo Screen
patchbay
```

Edit the patchbay code:

```text
[Video]
chan Composite

Camera -> Composite -> Screen
```

Video sent to `Camera` will pass through the virtual `Composite` channel and arrive at `Screen`.

## See Also

- [send](/docs/objects/send) - send messages to a named channel
- [recv](/docs/objects/recv) - receive messages from a named channel
- [send~](/docs/objects/send~) - send audio to a named channel
- [recv~](/docs/objects/recv~) - receive audio from a named channel
- [send.vdo](/docs/objects/send.vdo) - send video to a named channel
- [recv.vdo](/docs/objects/recv.vdo) - receive video from a named channel
- [Message Passing](/docs/message-passing) - how messages flow between objects
