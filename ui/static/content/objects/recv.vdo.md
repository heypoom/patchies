Receive video from a named channel. Works wirelessly with `send.vdo` objects broadcasting on the same channel.

## Usage

```text
recv.vdo <channel>
```

## Example

Create `recv.vdo foo` to receive video from any `send.vdo foo` objects in your patch. Video is delivered without needing visual connections.

```text
[hydra] → [send.vdo foo]     ...     [recv.vdo foo] → [glsl] → [bg.out]
```

Multiple `send.vdo` nodes on the same channel will have only the last sender's video displayed at the receiver (unlike audio which sums signals).

## Aliases

- `rv`

## See Also

- [send.vdo](/docs/objects/send.vdo) - send video to named channel
- [recv~](/docs/objects/recv~) - receive audio from named channel
- [recv](/docs/objects/recv) - receive messages from named channel
