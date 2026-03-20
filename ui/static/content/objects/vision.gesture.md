# vision.gesture

Real-time hand gesture recognition using MediaPipe GestureRecognizer.

Detects hand gestures (thumbs up, open palm, peace sign, etc.) along with
21 hand landmarks per hand.

## Output

```js
{
  gestures: [
    {
      gesture: string,        // e.g. 'Thumb_Up', 'Open_Palm', 'Victory', 'None'
      score: number,          // confidence 0–1
      handedness: 'Left' | 'Right',
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

**Built-in gestures:** `None`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou`.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| numHands | 2 | Maximum simultaneous hands to detect |
| delegate | GPU | Processing: `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame (1 = every frame) |

## Usage

Connect any video source to the video inlet:

```
webcam → vision.gesture → js
```

In the downstream `js` node, use `recv` to receive gesture data and trigger actions based on the recognized gesture name.

## See also

- [vision.hand](/objects/vision.hand) — hand landmarks only (faster, no gesture classification)
- [vision.face](/objects/vision.face) — facial landmarks
