Store and send predefined messages. Click to send.

## Message Format

- `hello` → sends `{type: 'hello'}`
- `"hello"` → sends string `"hello"`
- `100` → sends number `100`
- `{x: 1}` → sends object `{x: 1}`

## Space-Separated Arrays

Space-separated tokens are sent as an array:

- `1024 2048` → sends `[1024, 2048]`
- `bang 100 {x: 1}` → sends `[{type: 'bang'}, 100, {x: 1}]`
- `"hello world" 42` → sends `["hello world", 42]`

Each token is parsed individually (JSON5, number, or bare string).

## Sequential Messages

Use commas to send multiple messages in sequence:

```text
{type: 'set', value: 1}, bang, [255, 0, 0]
```

Sends in order: `{type: 'set', value: 1}`, then `{type: 'bang'}`, then `[255, 0, 0]`.

Commas inside `{}`, `[]`, and quotes are not treated as separators.

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
