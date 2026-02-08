Receive messages from a named channel. Works wirelessly with `send` objects broadcasting on the same channel.

## Usage

```text
recv <channel>
```

## Example

Create `recv foo` to listen for messages from any `send foo` objects in your patch. Messages are delivered immediately without needing visual connections.

## JavaScript API

From `js`, `worker`, or other JavaScript-enabled objects:

```javascript
// Receive from named channel
recv((data, meta) => {
  console.log(data);           // the message
  console.log(meta.channel);   // 'position'
  console.log(meta.source);    // sender's node ID
}, { channel: 'position' });

// Send to named channel
send({ x: 100, y: 200 }, { channel: 'position' });
```

Both visual objects and JavaScript code can share the same channels.

## See Also

- [send](/docs/objects/send) - send to named channel
- [Message Passing](/docs/message-passing) - how messages flow between objects
