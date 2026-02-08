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

## Aliases

- `s~`

## See Also

- [recv~](/docs/objects/recv~) - receive audio from named channel
- [send](/docs/objects/send) - send messages to named channel
