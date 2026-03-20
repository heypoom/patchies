# vision.face

Facial landmark detection (478 keypoints) using MediaPipe FaceLandmarker.

Optionally outputs 52 ARKit blendshape coefficients for expression tracking.

## Output

```js
{
  faces: [
    {
      landmarks: [   // 478 keypoints, normalized [0,1]
        { x, y, z }
      ],
      blendshapes: [ // when enabled in settings
        { categoryName: 'eyeBlinkLeft', score: 0.8 },
        // ...52 total
      ]
    }
  ],
  timestamp: number
}
```

**Blendshape examples:** `eyeBlinkLeft`, `eyeBlinkRight`, `jawOpen`, `mouthSmileLeft`, `browInnerUp`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| numFaces | 1 | Maximum simultaneous faces |
| blendshapes | false | Output 52 ARKit blendshape coefficients |
| delegate | GPU | `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame |

## See also

- [vision.hand](/objects/vision.hand) — hand skeleton
- [vision.body](/objects/vision.body) — body pose
