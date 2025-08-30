# 33. Drag and Drop Files

I want to support creating nodes simply by dropping in image, text and audio files into the canvas.

## Mapping

- Image files of mime `image/*` (.png, .jpg, .jpeg) -> create image node `img`
- Text files of mime `text/*` (.txt, .md) -> create Markdown node `markdown`
- Audio files of mime `audio/*` (.mp3, .wav, .flac) -> create sound file node `soundfile~`

## Where to edit

- `FlowCanvasInner.svelte`. We already have `onDrop` so maybe that could work.
