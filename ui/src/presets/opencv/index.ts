import { preset as contours } from './contours';
import { preset as threshold } from './threshold';

export const OPENCV_PRESETS = {
  'opencv-threshold.worker': threshold,
  'opencv-contours.worker': contours
};
