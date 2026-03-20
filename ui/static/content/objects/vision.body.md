# vision.body

Full-body pose estimation using MediaPipe PoseLandmarker. Detects up to 4 people with 33 body keypoints each.

## Inlets

| Index | Type | Description |
|-------|------|-------------|
| 0 | video | Video source |

## Outlets

| Index | Type | Description |
|-------|------|-------------|
| 0 | message | Detection results |

## Output

```js
{
  poses: [
    {
      landmarks: [          // 33 keypoints, normalized [0,1], with visibility
        { x, y, z, visibility }
      ],
      worldLandmarks: [     // 33 keypoints in meters
        { x, y, z, visibility }
      ]
    }
  ],
  timestamp: number
}
```

**Key landmark indices:** 0=nose, 11=left shoulder, 12=right shoulder, 13=left elbow, 14=right elbow, 15=left wrist, 16=right wrist, 23=left hip, 24=right hip, 25=left knee, 26=right knee, 27=left ankle, 28=right ankle.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| numPoses | 1 | Maximum simultaneous poses to detect |
| model | lite | `lite`, `full`, or `heavy` |
| delegate | GPU | `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame |

## See also

- [vision.hand](/objects/vision.hand) — hand skeleton
- [vision.face](/objects/vision.face) — facial landmarks
