# 36. Video Capture Nodes

Let's add some nodes that can capture video from a webcam or screen.

It should use the GLSystem's `setBitmap` or `setBitmapSource` method to upload, because `navigator` is not available in web workers, so we can't access `navigator.mediaDevices.getUserMedia` or `navigator.mediaDevices.getDisplayMedia` directly in the worker.

## Nodes

- `screen` - captures video from the screen. should use `getDisplayMedia`.
- `webcam` - captures video from the webcam. see `cam.p5` presets for reference.
