Receive audio from a named channel. Works wirelessly with `send~` objects
broadcasting on the same channel.

## Usage

```text
recv~ <channel>
```

## Example

Create `recv~ foo` to receive audio from any `send~ foo` objects in your
patch. Audio is delivered without needing visual connections.

```text
[osc~ 440] → [send~ foo]     ...     [recv~ foo] → [gain~] → [out~]
```

## Summing Bus

Multiple `send~` nodes on the same channel are automatically summed at the
receiver. This makes `send~`/`recv~` ideal for effect sends and submixes,
replacing Pure Data's `throw~`/`catch~` pattern.

```text
[synth1] → [send~ reverb]
[synth2] → [send~ reverb]
[drums]  → [send~ reverb]

[recv~ reverb] → [convolver~] → [out~]
```

## Aliases

- `r~`

## See Also

- [send~](/docs/objects/send~) - send audio to named channel
- [recv](/docs/objects/recv) - receive messages from named channel
