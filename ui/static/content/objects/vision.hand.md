# vision.hand

Real-time hand skeleton detection using MediaPipe HandLandmarker.
Detects up to 4 hands with 21 keypoints each.

## Inlets

| Index | Type | Description |
|-------|------|-------------|
| 0 | video | Video source (webcam, screen, video, etc.) |

## Outlets

| Index | Type | Description |
|-------|------|-------------|
| 0 | message | Detection results |

## Output

```js
{
  hands: [
    {
      handedness: 'Left' | 'Right',
      score: number,          // confidence 0–1
      landmarks: [            // 21 keypoints, normalized [0,1] x/y, z relative
        { x, y, z }
      ],
      worldLandmarks: [       // 21 keypoints in meters (real-world scale)
        { x, y, z }
      ]
    }
  ],
  timestamp: number
}
```

**Key landmark indices:** 0=wrist, 4=thumb tip, 8=index tip, 12=middle tip, 16=ring tip, 20=pinky tip.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| numHands | 2 | Maximum simultaneous hands to detect |
| model | lite | Model size: `lite` (faster) or `full` (more accurate) |
| delegate | GPU | Processing: `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame (1 = every frame) |

## Usage

Connect any video source to the video inlet:

```
webcam → vision.hand → js
```

In the downstream `js` node, use `recv` to receive hand data and draw landmarks on a canvas or drive animations.

## See also

- [vision.body](/objects/vision.body) — full-body pose
- [vision.face](/objects/vision.face) — facial landmarks
