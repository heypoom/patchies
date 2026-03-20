# vision.detect

Object detection with bounding boxes using MediaPipe ObjectDetector
(EfficientDet Lite0).

Recognizes 90 COCO object classes including people, animals, vehicles,
and everyday objects.

## Output

```js
{
  detections: [
    {
      label: string,       // e.g. 'person', 'cat', 'bottle', 'car'
      score: number,       // confidence 0–1
      boundingBox: {
        originX: number,   // normalized [0,1], left edge
        originY: number,   // normalized [0,1], top edge
        width: number,     // normalized width
        height: number     // normalized height
      }
    }
  ],
  timestamp: number
}
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| maxResults | 5 | Maximum detections per frame |
| scoreThreshold | 0.5 | Minimum confidence to include |
| delegate | GPU | `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame |

## See also

- [vision.hand](/objects/vision.hand) — hand skeleton
- [vision.segment](/objects/vision.segment) — body segmentation
