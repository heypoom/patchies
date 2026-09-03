# Virtual Filesystem

The virtual filesystem (VFS) stores images, videos, fonts, 3D models, and other patch assets.

![Virtual filesystem with canvas demo](/content/images/canvas-vfs.webp)

This VFS includes assets for a canvas demo. Add a file to the patch or link it from your local system.

## Managing Files

Use the sidebar to manage patch files. Open it with `Ctrl/Cmd + B > Files`. You can also click "Open Sidebar" at the bottom right.

See [Files](/docs/manage-files) for file management details.

## Loading Files in Code

Use `await vfs.getUrl(path)` to get the URL for a VFS file. Relative paths use the `user://` namespace:

```javascript
// In p5:
let img;

async function setup() {
  let url = await vfs.getUrl("./photo.jpg");
  img = await loadImage(url);
}

// In js or canvas.dom:
const data = await vfs.get("user://data.json").json();
```

VFS paths use the `user://` prefix for uploaded files. Patchies clears object URLs when it destroys the object.

## Browsing Files in Code

Use `vfs.list()` to inspect one folder level at a time. Use `vfs.search()` to find matching entries anywhere below a folder. Both return objects with `path`, `name`, and `kind` (`file` or `directory`):

```javascript
// Direct children of the user:// root, including folders.
const rootEntries = await vfs.list(".");

// Every matching path under user://samples.
const kicks = await vfs.search("kick", "./samples");
```

Both methods also browse linked local folders after you grant Patchies permission.

## Getting File Content

Read a file in the format you need:

```javascript
// Parse JSON
const data = await vfs.get("user://data.json").json();

// Get as Blob
const blob = await vfs.get("user://image.png").blob();

// Get as ArrayBuffer (for binary data)
const buffer = await vfs.get("user://audio.wav").arrayBuffer();

// Get as text
const text = await vfs.get("user://data.csv").text();
```

## Supported Objects

Use `vfs` in all [JavaScript Runner](/docs/javascript-runner)-based objects.

## See Also

- [Files](/docs/manage-files) — Manage files in the sidebar.
- [JavaScript Runner](/docs/javascript-runner) — Use the full JSRunner API.
- [Data Storage](/docs/data-storage) — Store persistent key-value data.
