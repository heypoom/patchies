# Patchies JavaScript Runner

Most JavaScript-based nodes in Patchies use the unified JavaScript Runner (JSRunner), which executes code in a sandboxed environment with Patchies-specific features.

## Supported Nodes

Full JSRunner features are available in: `js`, `worker`, `p5`, `canvas`, `canvas.dom`, `textmode`, `textmode.dom`, `three`, `three.dom`, `hydra`, `dom`, `vue`, `sonic~`, `tone~` and `elem~`.

Some nodes use _single-expression evaluation_ mode (`filter`, `map`, `tap`, `scan`) where the expression is evaluated once per message. These cannot use messaging callbacks like `send`, `recv`, `onCleanup`, timers, etc.

## Common Runtime Functions

### Console

Use `console.log()` to log messages to the virtual console (not the browser console).

### Timers (auto-cleanup)

All timers are automatically cleaned up when the node is unmounted or code is re-executed:

- `setInterval(callback, ms)` - runs callback every `ms` milliseconds
- `setTimeout(callback, ms)` - runs callback after `ms` milliseconds
- `delay(ms)` - returns a Promise that resolves after `ms` milliseconds
- `requestAnimationFrame(callback)` - schedules callback for next animation frame

**Important**: Do not use `window.setInterval`, `window.setTimeout`, or `window.requestAnimationFrame` as they will not clean up automatically.

### Custom Cleanup

Use `onCleanup(callback)` to register cleanup logic that runs when the node is unmounted or code is re-executed. Useful for disconnecting resources or unsubscribing from events.

### Message Passing

- `send(message)` - send a message out of the default outlet
- `send(outlet, message)` - send a message out of a specific outlet (0-indexed)
- `recv(callback)` - receive messages from connected inlets

Use `meta.inlet` in the `recv` callback to distinguish which inlet the message came from.

### Port Configuration

- `setPortCount(inletCount, outletCount)` - set the number of message inlets and outlets

### Node Title

- `setTitle(title)` - set the display title of the node

### Async Support

Top-level `await` is supported. Use `await delay(ms)` to pause execution.

### Audio Analysis

Use `fft()` to get audio frequency data from a connected `fft~` node. See [Audio Analysis](/docs/audio-analysis) for details.

### LLM Integration

Use `await llm(prompt, options?)` to call Google's Gemini API:

```javascript
const response = await llm("Describe this image");

// With options
const response = await llm("What's in this frame?", {
  imageNodeId: "node-123",  // include visual node output as context
  abortSignal: controller.signal
});
```

Requires a Gemini API key set in settings: `Ctrl/Cmd + K > Gemini`

## Importing NPM Packages

Use the `npm:` prefix in import statements:

```javascript
import Matter from "npm:matter-js";
import { uniq } from "npm:lodash-es";

console.log(uniq([1, 1, 2, 2, 3, 3])); // [1, 2, 3]
```

Or use dynamic imports:

```javascript
const { uniq } = await import("https://esm.sh/lodash-es");

// or use the shorthand
const { uniq } = await esm("lodash-es");
```

## Virtual Filesystem

Use `await getVfsUrl(path)` to load files from the virtual filesystem:

```javascript
// In p5:
let img;

async function setup() {
  let url = await getVfsUrl("user://photo.jpg");
  img = await loadImage(url);
}

// In js or canvas.dom:
const url = await getVfsUrl("user://data.json");
const data = await fetch(url);
```

VFS paths use the `user://` prefix for user-uploaded files. Object URLs are automatically cleaned up when the node is destroyed.

## Shared Libraries

Share code across multiple `js` blocks using the `// @lib <name>` comment:

```javascript
// In a js node with "// @lib utils" at the top:
export const rand = () => Math.random();
export class Vector { /* ... */ }

// In other nodes:
import { rand, Vector } from 'utils';
```

Note: Constants are NOT shared across objects. Each object has its own isolated execution context. Use message passing to communicate between objects.

## See Also

- [Canvas Interaction Control](/docs/canvas-interaction)
- [Audio Analysis](/docs/audio-analysis)
- [Message Passing](/docs/message-passing)
