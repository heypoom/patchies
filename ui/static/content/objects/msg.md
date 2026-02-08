Store and send predefined messages. Click to send.

## Message Format

- `hello` → sends `{type: 'hello'}`
- `"hello"` → sends string `"hello"`
- `100` → sends number `100`
- `{x: 1}` → sends object `{x: 1}`

## Placeholders

Use `$1` to `$9` for dynamic values:

```text
{type: 'noteOn', note: $1, velocity: 100}
```

## Messages

- **bang** → outputs stored message
- **set** → `{type: 'set', value: ...}` sets without triggering

## See Also

- [trigger](/docs/objects/trigger) - control message order
- [Message Passing](/docs/message-passing) - how messages flow
