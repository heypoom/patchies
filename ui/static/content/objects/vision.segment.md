# vision.segment

Body segmentation using MediaPipe ImageSegmenter. Outputs a greyscale mask as video — white = foreground (person), black = background. Use as a video texture in GLSL/Hydra for compositing effects.

## Inlets

| Index | Type | Description |
|-------|------|-------------|
| 0 | video | Video source |

## Outlets

| Index | Type | Description |
|-------|------|-------------|
| 0 | video | Greyscale segmentation mask |
| 1 | message | Raw mask data (when "Output Message" is enabled) |

## Message output (outlet 1)

```js
{
  width: number,
  height: number,
  mask: Uint8Array,        // category mask: 0=background, 1=person
       | Float32Array,     // confidence mask: 0.0–1.0
  maskType: 'category' | 'confidence',
  timestamp: number
}
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| maskType | category | `category` (binary) or `confidence` (greyscale 0–1) |
| outputMessage | false | Also emit raw mask on outlet 1 |
| delegate | GPU | `GPU` or `CPU` |
| skipFrames | 1 | Process every Nth frame |

## Usage

Connect to a GLSL shader to composite video over a background:

```text
webcam ─────────────────────► glsl (sampler0: person video)
         └─ vision.segment ──► glsl (sampler1: mask)
```

In the GLSL shader, multiply the video by the mask to remove the background.

## See also

- [vision.detect](/objects/vision.detect) — object detection
