Send messages to a named channel. Works wirelessly with `recv` objects listening on the same channel.

## Usage

```text
send <channel>
```

## Example

Create `send foo` and `recv foo` anywhere in your patch. Messages sent to the inlet will appear at the recv outlet without needing a visible connection.

## JavaScript API

From `js`, `worker`, or other JavaScript-enabled objects:

```javascript
// Send to named channel
send({ x: 100, y: 200 }, { channel: 'position' });

// Receive from named channel
recv((data) => console.log(data), { channel: 'position' });
```

Both visual objects and JavaScript code can share the same channels.

## See Also

- [recv](/docs/objects/recv) - receive from named channel
- [Message Passing](/docs/message-passing) - how messages flow between objects
