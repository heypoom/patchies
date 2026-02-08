Send video to a named channel. Works wirelessly with `recv.vdo` objects listening on the same channel.

## Usage

```text
send.vdo <channel>
```

## Inlets

1. **Video input** - video to broadcast on the channel
2. **Channel name** - string message to change channel dynamically

## Example

Create `send.vdo foo` and `recv.vdo foo` anywhere in your patch. Video sent to the inlet will appear at the recv.vdo outlet without needing a visible connection.

```text
[hydra] → [send.vdo foo]     ...     [recv.vdo foo] → [glsl] → [bg.out]
```

You can dynamically change the channel by sending a string to the second inlet:

```text
[message bar] → [send.vdo foo]  // changes channel to "bar"
```

## Aliases

- `sv`

## See Also

- [recv.vdo](/docs/objects/recv.vdo) - receive video from named channel
- [send~](/docs/objects/send~) - send audio to named channel
- [send](/docs/objects/send) - send messages to named channel
