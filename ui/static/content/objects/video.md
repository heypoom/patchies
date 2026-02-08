The `video` object loads and displays videos from URLs or local files.

## Getting Started

Create a `video` object and send it a URL to load a video, e.g. `https://example.com/video.mp4`

Or use a file from the [virtual filesystem](/docs/manage-files) with the `user://` prefix.

## Video and Audio Chaining

The `video` object supports both video and audio chaining:

- Connect the video outlet to visual objects like `glsl`, `hydra`
- Connect the audio outlet to audio processing objects

## Performance

See [Rendering Pipeline](/docs/rendering-pipeline) for performance notes on video playback, including:

- MediaBunny/WebCodecs optimization on Chromium
- Video stats overlay (`Ctrl/Cmd + K > Toggle Video Stats Overlay`)

## See Also

- [img](/docs/objects/img) - display images
- [webcam](/docs/objects/webcam) - capture from camera
- [Rendering Pipeline](/docs/rendering-pipeline) - performance details
