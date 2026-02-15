Store and send predefined messages. Click to send.

## Message Format

Messages are defined in [JSON5 format](https://json5.org).

- `"hello"` sends string `"hello"`
- `'hello'` sends string `"hello"`
- `100` sends number `100`
- `{x: 1}` sends object `{x: 1}`

## Control Message Shorthand

Control messages in Patchies are objects with a `type` field.

For control messages with a single `type` field, you can write the
message type to use the object with type shorthand.

- `hello` sends `{ type: 'hello' }`
- `bang` sends `{ type: 'bang' }`

## Placeholders

Use `$1` to `$9` for dynamic values:

```js
{ type: 'noteOn', note: $1, velocity: 100 }
```

## Positional Field Shorthand

If the first token matches a _known_ message type, positional arguments
are mapped to schema fields:

- `set 1` sends `{ type: 'set', value: 1 }`
- `get foo` sends `{ type: 'get', key: 'foo' }`
- `set foo 42` sends `{ type: 'set', key: 'foo', value: 42 }`

- `setCode console.log(x) + 1` sends:

```js
{ type: 'setCode', value: 'console.log(x) + 1' }
```

The number of arguments selects the schema. `set 1` uses the 1-field `{value}`
schema, while `set foo 42` uses the 2-field `{key, value}` schema.

## Named Field Shorthand

Use `field=value` for explicit field assignment:

- `set value=1` sends `{ type: 'set', value: 1 }`
- `set key=foo value=42` sends `{ type: 'set', key: 'foo', value: 42 }`

Named and positional can mix: `set foo value=42` becomes:

```js
{ type: 'set', key: 'foo', value: 42 }
```

If no schema matches the argument count, falls back to space-separated arrays.

## Space-Separated Arrays

When the first token is not a known message type,
space-separated tokens are sent as an array:

- `1024 2048` sends `[1024, 2048]`
- `"hello world" 42` sends `["hello world", 42]`
- `hello world` sends `[{type: 'hello'}, {type: 'world'}]`

Each token is parsed individually (JSON5 format, number, or bare string).

## Sequential Messages

Use commas to send multiple messages in sequence:

```js
{type: 'set', value: 1}, bang, [255, 0, 0]
```

Sends in order: `{type: 'set', value: 1}`, then `{type: 'bang'}`,
then `[255, 0, 0]`.

Commas inside `{}`, `[]`, and quotes are not treated as separators.

## See Also

- [Message Passing](/docs/message-passing) - how messages flow
- [trigger](/docs/objects/trigger) - control message order
