Route named message channels with a compact text patchbay.

## Usage

```text
patchbay
```

The first version of `patchbay` routes message channels only. Audio and video routing are planned, but not active yet.

## How It Works

`patchbay` is for channels, not object titles. A name in a route must be either:

1. Declared with `chan` inside the `[Message]` section
2. An existing message channel from `send`, `recv`, or JavaScript `send()` / `recv()` channel usage

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

## See Also

- [send](/docs/objects/send) - send messages to a named channel
- [recv](/docs/objects/recv) - receive messages from a named channel
- [Message Passing](/docs/message-passing) - how messages flow between objects
