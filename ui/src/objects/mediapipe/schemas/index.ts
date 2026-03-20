/**
 * Object schemas for MediaPipe vision nodes.
 */

import { Type } from '@sinclair/typebox';
import { schema } from '$lib/objects/schemas/types';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas/common';

// ---- Shared sub-schemas ----

const Point3D = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number()
});

const Point4D = Type.Object({
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number(),
  visibility: Type.Number()
});

const BoundingBox = Type.Object({
  originX: Type.Number(),
  originY: Type.Number(),
  width: Type.Number(),
  height: Type.Number()
});

// ---- Output message schemas ----

export const HandOutput = Type.Object({
  type: Type.Literal('output'),
  hands: Type.Array(
    Type.Object({
      handedness: Type.Union([Type.Literal('Left'), Type.Literal('Right')]),
      score: Type.Number(),
      landmarks: Type.Array(Point3D),
      worldLandmarks: Type.Array(Point3D)
    })
  ),
  timestamp: Type.Number()
});

export const BodyOutput = Type.Object({
  type: Type.Literal('output'),
  poses: Type.Array(
    Type.Object({
      landmarks: Type.Array(Point4D),
      worldLandmarks: Type.Array(Point4D)
    })
  ),
  timestamp: Type.Number()
});

export const FaceOutput = Type.Object({
  type: Type.Literal('output'),
  faces: Type.Array(
    Type.Object({
      landmarks: Type.Optional(Type.Array(Point3D)),
      blendshapes: Type.Optional(
        Type.Array(
          Type.Object({
            categoryName: Type.String(),
            score: Type.Number()
          })
        )
      ),
      boundingBox: Type.Optional(BoundingBox),
      score: Type.Optional(Type.Number()),
      keypoints: Type.Optional(
        Type.Array(
          Type.Object({
            x: Type.Number(),
            y: Type.Number(),
            label: Type.Optional(Type.String())
          })
        )
      )
    })
  ),
  timestamp: Type.Number()
});

export const GestureOutput = Type.Object({
  type: Type.Literal('output'),
  gestures: Type.Array(
    Type.Object({
      gesture: Type.String(),
      score: Type.Number(),
      handedness: Type.Union([Type.Literal('Left'), Type.Literal('Right')]),
      landmarks: Type.Array(Point3D),
      worldLandmarks: Type.Array(Point3D)
    })
  ),
  timestamp: Type.Number()
});

export const ClassifyOutput = Type.Object({
  type: Type.Literal('output'),
  classifications: Type.Array(
    Type.Object({
      label: Type.String(),
      score: Type.Number()
    })
  ),
  timestamp: Type.Number()
});

export const DetectOutput = Type.Object({
  type: Type.Literal('output'),
  detections: Type.Array(
    Type.Object({
      label: Type.String(),
      score: Type.Number(),
      boundingBox: BoundingBox
    })
  ),
  timestamp: Type.Number()
});

export const SegmentOutput = Type.Object({
  type: Type.Literal('output'),
  width: Type.Number(),
  height: Type.Number(),
  mask: Type.Any(),
  maskType: Type.Union([Type.Literal('category'), Type.Literal('confidence')]),
  timestamp: Type.Number()
});

/** Pre-wrapped matchers for use with ts-pattern */
export const visionMessages = {
  hand: schema(HandOutput),
  body: schema(BodyOutput),
  face: schema(FaceOutput),
  gesture: schema(GestureOutput),
  classify: schema(ClassifyOutput),
  detect: schema(DetectOutput),
  segment: schema(SegmentOutput)
};

// ---- Common inlet definitions ----

const videoInlet = {
  id: 'video',
  description: 'Video input',
  handle: { handleType: 'video' as const }
};

const enableInlet = {
  id: 'enable',
  description: 'Enable/disable (bang toggles, 1/true enables, 0/false disables)',
  handle: { handleType: 'message' as const },
  messages: [
    { schema: Bang, description: 'Toggle enabled state' },
    { schema: Type.Boolean(), description: 'Set enabled state directly' },
    { schema: Type.Number(), description: '0 disables, non-zero enables' }
  ]
};

// ---- Object schemas ----

export const visionHandSchema: ObjectSchema = {
  type: 'vision.hand',
  category: 'vision',
  description: 'Detect hand landmarks (21 points per hand) in real-time using MediaPipe',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'result',
      description: 'Hand tracking results',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: HandOutput,
          description: 'Hand landmarks and handedness for each detected hand'
        }
      ]
    }
  ],
  tags: ['mediapipe', 'hand', 'landmark', 'gesture', 'tracking', 'ml', 'vision', 'camera']
};

export const visionBodySchema: ObjectSchema = {
  type: 'vision.body',
  category: 'vision',
  description: 'Detect body pose landmarks (33 points) in real-time using MediaPipe',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'result',
      description: 'Pose estimation results',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: BodyOutput,
          description: 'Body pose landmarks with visibility scores for each detected person'
        }
      ]
    }
  ],
  tags: ['mediapipe', 'body', 'pose', 'skeleton', 'landmark', 'tracking', 'ml', 'vision']
};

export const visionFaceSchema: ObjectSchema = {
  type: 'vision.face',
  category: 'vision',
  description: 'Detect face landmarks (478 points) or bounding boxes using MediaPipe',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'result',
      description: 'Face detection/landmark results',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: FaceOutput,
          description:
            'Face landmarks (478 pts), optional blendshapes, or bounding boxes (detect mode)'
        }
      ]
    }
  ],
  tags: ['mediapipe', 'face', 'landmark', 'blendshape', 'detection', 'ml', 'vision', 'mesh']
};

export const visionGestureSchema: ObjectSchema = {
  type: 'vision.gesture',
  category: 'vision',
  description: 'Recognize hand gestures and landmarks using MediaPipe',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'result',
      description: 'Gesture recognition results',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: GestureOutput,
          description: 'Recognized gesture, confidence score, handedness, and hand landmarks'
        }
      ]
    }
  ],
  tags: [
    'mediapipe',
    'gesture',
    'hand',
    'recognition',
    'landmark',
    'tracking',
    'ml',
    'vision',
    'camera'
  ]
};

export const visionClassifySchema: ObjectSchema = {
  type: 'vision.classify',
  category: 'vision',
  description: 'Classify the content of a video frame using MediaPipe EfficientNet',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'result',
      description: 'Image classification results',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: ClassifyOutput,
          description: 'Top classification labels and confidence scores'
        }
      ]
    }
  ],
  tags: ['mediapipe', 'classify', 'image', 'recognition', 'label', 'ml', 'vision', 'efficientnet']
};

export const visionDetectSchema: ObjectSchema = {
  type: 'vision.detect',
  category: 'vision',
  description: 'Detect objects with bounding boxes in a video frame using MediaPipe EfficientDet',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'result',
      description: 'Object detection results',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: DetectOutput,
          description: 'Detected objects with labels, scores, and bounding boxes'
        }
      ]
    }
  ],
  tags: [
    'mediapipe',
    'detect',
    'object',
    'bounding box',
    'recognition',
    'ml',
    'vision',
    'efficientdet'
  ]
};

export const visionSegmentSchema: ObjectSchema = {
  type: 'vision.segment',
  category: 'vision',
  description:
    'Segment people from the background, outputting a greyscale mask video using MediaPipe',
  inlets: [videoInlet, enableInlet],
  outlets: [
    {
      id: 'mask',
      description: 'Greyscale segmentation mask video (white=person, black=background)',
      handle: { handleType: 'video', handleId: '0' }
    },
    {
      id: 'data',
      description: 'Raw mask data (when "Output Message" is enabled in settings)',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: SegmentOutput,
          description: 'Raw mask pixel data as Uint8Array (category) or Float32Array (confidence)'
        }
      ]
    }
  ],
  hasDynamicOutlets: true,
  tags: ['mediapipe', 'segment', 'background', 'mask', 'person', 'matting', 'ml', 'vision']
};
