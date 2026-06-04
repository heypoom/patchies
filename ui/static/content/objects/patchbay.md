Route named message and audio channels with a compact text patchbay.

## Usage

```text
patchbay
```

`patchbay` currently routes message and audio channels. Video routing is planned, but not active yet.

## How It Works

`patchbay` is for channels, not object titles. A name in a route must be either:

1. Declared with `chan` inside the matching section
2. An existing message channel from `send`, `recv`, or JavaScript `send()` / `recv()` channel usage
3. An existing audio channel from `send~` or `recv~`

```text
[Message]
chan Logger

Clock -> Logger
Logger -> Lights
```

This forwards messages from `Clock` to `Logger`, then from `Logger` to `Lights`.

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

## See Also

- [send](/docs/objects/send) - send messages to a named channel
- [recv](/docs/objects/recv) - receive messages from a named channel
- [send~](/docs/objects/send~) - send audio to a named channel
- [recv~](/docs/objects/recv~) - receive audio from a named channel
- [Message Passing](/docs/message-passing) - how messages flow between objects
