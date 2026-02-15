The `iframe` object embeds external web pages and interactive web content in your patches.

## Getting Started

Create an iframe with a URL:

```
iframe example.com
```

Or double-click the object to enter a URL when no content is loaded.

## Use Cases

- Embed interactive web tools
- Integrate with [WebMIDILink](https://www.g200kg.com/en/docs/webmidilink) synthesizers
- Display external visualizations
- Connect to web-based instruments

## Security

The iframe is sandboxed and loaded with the `credentialless` attribute
for security. This means the embedded page runs in an ephemeral context
without access to the parent page's cookies or storage.
Some features may be restricted.

## See Also

- [Message Passing](/docs/message-passing) - communicate between objects
