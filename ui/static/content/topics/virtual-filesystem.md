# Virtual Filesystem

The virtual filesystem (VFS) stores images, videos, fonts, 3D models, and other patch assets.

![Virtual filesystem with canvas demo](/content/images/canvas-vfs.webp)

This VFS includes assets for a canvas demo. Add a file to the patch or link it from your local system.

## Managing Files

Use the sidebar to manage patch files. Open it with `Ctrl/Cmd + B > Files`. You can also click "Open Sidebar" at the bottom right.

See [Files](/docs/manage-files) for file management details.

## Loading Files in Code

Use `await getVfsUrl(path)` to get the URL for a VFS file:

```javascript
// In p5:
let img;

async function setup() {
  let url = await getVfsUrl("user://photo.jpg");
  img = await loadImage(url);
}

// In js or canvas.dom:
const url = await getVfsUrl("user://data.json");
const data = await fetch(url).then(r => r.json());
```

VFS paths use the `user://` prefix for uploaded files. Patchies clears object URLs when it destroys the object.

## Getting File Content

Get the underlying Blob or raw data:

```javascript
// Get as Blob
const blob = await fetch(await getVfsUrl("user://image.png")).then(r => r.blob());

// Get as ArrayBuffer (for binary data)
const buffer = await fetch(await getVfsUrl("user://audio.wav")).then(r => r.arrayBuffer());

// Get as text
const text = await fetch(await getVfsUrl("user://data.csv")).then(r => r.text());
```

## Supported Objects

Use `getVfsUrl()` in all [JavaScript Runner](/docs/javascript-runner) objects.

## See Also

- [Files](/docs/manage-files) — Manage files in the sidebar.
- [JavaScript Runner](/docs/javascript-runner) — Use the full JSRunner API.
- [Data Storage](/docs/data-storage) — Store persistent key-value data.
