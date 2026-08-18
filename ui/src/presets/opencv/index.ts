import { preset as colorMask } from './color-mask';
import { preset as contours } from './contours';
import { preset as edges } from './edges';
import { preset as motion } from './motion';
import { preset as threshold } from './threshold';

export const OPENCV_PRESETS = {
  'opencv-color-mask.worker': colorMask,
  'opencv-threshold.worker': threshold,
  'opencv-contours.worker': contours,
  'opencv-edges.worker': edges,
  'opencv-motion.worker': motion
};
