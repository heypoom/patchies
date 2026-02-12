The `webcam` object captures live video from your webcam or camera.

## Getting Started

Create a `webcam` object and send it a `bang` to start capture:

1. Create the `webcam` object
2. Connect a `loadbang` or button to send `bang`
3. The webcam video appears and can be chained to other visual objects

Resolution is requested as ideal. Actual resolution may vary based on camera capabilities.

## Switching Cameras

Hover over the webcam node and click the gear icon to open settings.
Select from available cameras using the dropdown.
The camera will automatically restart if already capturing.

## Performance

See [Rendering Pipeline](/docs/rendering-pipeline) for performance notes, including:

- `MediaStreamTrackProcessor` optimization on Chromium
- Video stats overlay (`Ctrl/Cmd + K > Toggle Video Stats Overlay`)

## See Also

- [video](/docs/objects/video) - display video files
- [img](/docs/objects/img) - display images
- [Rendering Pipeline](/docs/rendering-pipeline) - performance details
