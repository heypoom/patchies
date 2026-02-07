The `img` object loads and displays images from URLs or local files.

## Getting Started

Create an `img` object and send it a URL to load an image:

```
https://example.com/image.png
```

Or use a file from the [virtual filesystem](/docs/manage-files) with the `user://` prefix.

## Video Chaining

The `img` object runs on the [rendering pipeline](/docs/rendering-pipeline) and can be used as a texture source for other visual objects like `glsl`, `hydra`, and `shader` without performance overhead.

## Messages

| Message | Description |
|---------|-------------|
| `string` | Load image from the given URL |

## See Also

- [video](/docs/objects/video) - display videos
- [webcam](/docs/objects/webcam) - capture from camera
- [glsl](/docs/objects/glsl) - use as texture in shaders
