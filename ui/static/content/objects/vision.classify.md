# vision.classify

Image classification using MediaPipe ImageClassifier (EfficientNet Lite0).

Returns the top matching labels from 1000 ImageNet classes for each frame.

## Output

```js
{
  classifications: [
    {
      label: string,   // e.g. 'golden retriever', 'tabby cat', 'electric guitar'
      score: number    // confidence 0–1
    }
  ],
  timestamp: number
}
```

Results are sorted by score descending. The first entry is the top prediction.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| maxResults | 5 | Maximum labels to return per frame |
| scoreThreshold | 0.0 | Minimum confidence to include a result |
| delegate | GPU | Processing: `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame (1 = every frame) |

## Usage

Connect any video source to the video inlet:

```text
webcam → vision.classify → js
```

In the downstream `js` node, use `recv` to receive classification data and display or react to the top label.

## See also

- [vision.detect](/objects/vision.detect) — object detection with bounding boxes
- [vision.segment](/objects/vision.segment) — person segmentation mask
