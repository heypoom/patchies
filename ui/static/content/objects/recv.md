Receive messages from a named channel. Works wirelessly with `send` objects broadcasting on the same channel.

## Usage

```text
recv <channel>
```

## Example

Create `recv foo` to listen for messages from any `send foo` objects in your patch. Messages are delivered immediately without needing visual connections.

## JavaScript API

From `js`, `worker`, or other JavaScript-enabled objects, you can send messages to `recv`:

```javascript
// Send to named channels
send('foobar', { to: 'foo' });
```

Both visual objects and JavaScript code can share the same channels. See the [JavaScript Runner](/docs/javascript-runner) page for more on the API.

## See Also

- [send](/docs/objects/send) - send to named channel
- [Message Passing](/docs/message-passing) - how messages flow between objects
