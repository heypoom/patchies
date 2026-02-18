The `iframe` object embeds external web pages and interactive web content
in your patches.

## Getting Started

Create an iframe with a URL:

```txt
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
without access to the parent page's cookies or storage. Some features may be restricted.

## Browser Compatibility

Cross-origin iframes require the `credentialless` attribute, which is supported
in **Chrome** and **Safari** but not yet in Firefox. If you're using Firefox,
you'll see a warning message suggesting to use a supported browser.

Patchies uses COEP (Cross-Origin-Embedder-Policy) to enable
SharedArrayBuffer for audio worklets. The `credentialless` attribute allows
cross-origin iframes to work under COEP.

Self-hosting Patchies without COEP headers allows iframes in all browsers,
but disables SharedArrayBuffer features (falls back to postMessage transfers).

## See Also

- [Message Passing](/docs/message-passing) - communicate between objects
