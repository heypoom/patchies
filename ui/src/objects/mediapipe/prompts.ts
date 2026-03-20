export const visionHandPrompt = `## vision.hand Instructions

Real-time hand skeleton detection using MediaPipe HandLandmarker. Connect a video source to its video inlet. Results emit on outlet 0.

**Output shape:**
\`\`\`js
{
  hands: [{
    handedness: 'Left' | 'Right',
    score: number,
    landmarks: [{x, y, z}],       // 21 keypoints, normalized [0,1]
    worldLandmarks: [{x, y, z}]   // 21 keypoints in meters
  }],
  timestamp: number
}
\`\`\`

**Landmark indices:** 0=wrist, 4=thumb tip, 8=index tip, 12=middle tip, 16=ring tip, 20=pinky tip.

**Example (draw hand on p5):**
\`\`\`json
{
  "type": "vision.hand",
  "data": { "numHands": 2, "model": "lite", "delegate": "GPU", "skipFrames": 1 }
}
\`\`\`

Connect: webcam → vision.hand → js (recv to draw landmarks)`;

export const visionBodyPrompt = `## vision.body Instructions

Full-body pose estimation using MediaPipe PoseLandmarker. Connect a video source to its video inlet. Results emit on outlet 0.

**Output shape:**
\`\`\`js
{
  poses: [{
    landmarks: [{x, y, z, visibility}],       // 33 keypoints, normalized [0,1]
    worldLandmarks: [{x, y, z, visibility}]   // 33 keypoints in meters
  }],
  timestamp: number
}
\`\`\`

**Key landmark indices:** 0=nose, 11=left shoulder, 12=right shoulder, 23=left hip, 24=right hip, 25=left knee, 26=right knee.

**Example:**
\`\`\`json
{
  "type": "vision.body",
  "data": { "numPoses": 1, "model": "lite", "delegate": "GPU", "skipFrames": 1 }
}
\`\`\``;

export const visionFacePrompt = `## vision.face Instructions

Facial landmark detection (478 points) using MediaPipe FaceLandmarker. Connect a video source to its video inlet. Results emit on outlet 0.

**Output shape:**
\`\`\`js
{
  faces: [{
    landmarks: [{x, y, z}],   // 478 facial keypoints, normalized [0,1]
    blendshapes?: [{categoryName: string, score: number}]  // when enabled
  }],
  timestamp: number
}
\`\`\`

Enable blendshapes in settings to get 52 ARKit-compatible expression coefficients (eyeBlinkLeft, jawOpen, etc.).

**Example:**
\`\`\`json
{
  "type": "vision.face",
  "data": { "numFaces": 1, "blendshapes": false, "delegate": "GPU", "skipFrames": 1 }
}
\`\`\``;

export const visionSegmentPrompt = `## vision.segment Instructions

Body segmentation using MediaPipe ImageSegmenter. Outputs a greyscale mask bitmap on outlet 0 (video), suitable for use as a texture in GLSL/Hydra. Optionally also emits raw mask data on outlet 1 (message).

**Video outlet 0:** Greyscale ImageBitmap mask — connect to glsl/hydra as a video texture.
**Message outlet 1 (optional, enable "Output Message" in settings):**
\`\`\`js
{
  width: number, height: number,
  mask: Uint8Array | Float32Array,
  maskType: 'category' | 'confidence',
  timestamp: number
}
\`\`\`

**Example:**
\`\`\`json
{
  "type": "vision.segment",
  "data": { "maskType": "category", "outputMessage": false, "delegate": "GPU", "skipFrames": 1 }
}
\`\`\``;

export const visionDetectPrompt = `## vision.detect Instructions

Object detection with bounding boxes using MediaPipe ObjectDetector (EfficientDet Lite0, 90 COCO classes). Connect a video source to its video inlet. Results emit on outlet 0.

**Output shape:**
\`\`\`js
{
  detections: [{
    label: string,     // e.g. 'person', 'cat', 'bottle'
    score: number,     // confidence 0–1
    boundingBox: { originX, originY, width, height }  // normalized [0,1]
  }],
  timestamp: number
}
\`\`\`

**Example:**
\`\`\`json
{
  "type": "vision.detect",
  "data": { "maxResults": 5, "scoreThreshold": 0.5, "delegate": "GPU", "skipFrames": 1 }
}
\`\`\``;
