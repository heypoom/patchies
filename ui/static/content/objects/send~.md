Send audio to a named channel. Works wirelessly with `recv~` objects listening on the same channel.

## Usage

```text
send~ <channel>
```

## Example

Create `send~ foo` and `recv~ foo` anywhere in your patch. Audio sent to the inlet will appear at the recv~ outlet without needing a visible connection.

```text
[osc~ 440] → [send~ foo]     ...     [recv~ foo] → [gain~] → [out~]
```

## Summing Bus

Multiple `send~` nodes can send to the same channel. All signals are
automatically summed at the receiver, making this ideal for effect sends
and submixes:

```text
[synth1] → [send~ reverb]
[synth2] → [send~ reverb]
[drums]  → [send~ reverb]

[recv~ reverb] → [convolver~] → [out~]
```

This replaces Pure Data's `throw~`/`catch~` pattern.

## Aliases

- `s~`

## See Also

- [recv~](/docs/objects/recv~) - receive audio from named channel
- [send](/docs/objects/send) - send messages to named channel
