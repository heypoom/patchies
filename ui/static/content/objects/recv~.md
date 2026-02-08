Receive audio from a named channel. Works wirelessly with `send~` objects broadcasting on the same channel.

## Usage

```text
recv~ <channel>
```

## Example

Create `recv~ foo` to receive audio from any `send~ foo` objects in your patch. Audio is delivered without needing visual connections.

```text
[osc~ 440] → [send~ foo]     ...     [recv~ foo] → [gain~] → [out~]
```

Multiple `send~` nodes on the same channel will have their signals summed at the receiver (Web Audio default behavior).

## Aliases

- `r~`

## See Also

- [send~](/docs/objects/send~) - send audio to named channel
- [recv](/docs/objects/recv) - receive messages from named channel
