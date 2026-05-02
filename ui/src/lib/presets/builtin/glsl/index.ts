import { preset as preset0 } from './passthru';
import { preset as preset1 } from './mix';
import { preset as preset2 } from './constant';
import { preset as preset3 } from './linear-ramp';
import { preset as preset4 } from './radial-ramp';
import { preset as preset5 } from './circular-ramp';
import { preset as preset6 } from './level';
import { preset as preset7 } from './transform';
import { preset as preset8 } from './multiply';
import { preset as preset9 } from './blur';
import { preset as preset10 } from './crop';
import { preset as preset11 } from './reorder';
import { preset as preset12 } from './displace';
import { preset as preset13 } from './edge';
import { preset as preset14 } from './noise';
import { preset as preset15 } from './noise-displace';
import { preset as preset16 } from './feedback';
import { preset as preset17 } from './fft-frequency';
import { preset as preset18 } from './fft-waveform';
import { preset as preset19 } from './switcher';
import { preset as preset20 } from './position-field';
import { preset as preset21 } from './torus-position-field';
import { preset as preset22 } from './add';
import { preset as preset23 } from './subtract';
import { preset as preset24 } from './difference';
import { preset as preset25 } from './composite';
import { preset as preset26 } from './over';
import { preset as preset27 } from './under';
import { preset as preset28 } from './threshold';
import { preset as preset29 } from './chroma-key';
import { preset as preset30 } from './rgb-key';
import { preset as preset31 } from './luma-key';
import { preset as preset32 } from './matte';
import { preset as preset33 } from './hsv-adjust';
import { preset as preset34 } from './monochrome';
import { preset as preset35 } from './channel-mix';
import { preset as preset36 } from './limit';
import { preset as preset37 } from './remap';
import { preset as preset38 } from './lookup';
import { preset as preset39 } from './rgb-to-hsv';
import { preset as preset40 } from './hsv-to-rgb';
import { preset as preset41 } from './tone-map';
import { preset as preset42 } from './fit';
import { preset as preset43 } from './flip';
import { preset as preset44 } from './mirror';
import { preset as preset45 } from './tile';
import { preset as preset46 } from './lens-distort';
import type { GLSLPreset } from './types';

export const GLSL_PRESETS: Record<string, GLSLPreset> = {
  'glsl>': preset0,
  Mix: preset1,
  Constant: preset2,
  'Linear Ramp': preset3,
  'Radial Ramp': preset4,
  'Circular Ramp': preset5,
  Level: preset6,
  Transform: preset7,
  Multiply: preset8,
  Blur: preset9,
  Crop: preset10,
  Reorder: preset11,
  Displace: preset12,
  Edge: preset13,
  Noise: preset14,
  'Noise Displace': preset15,
  Feedback: preset16,
  'FFT Frequency GL': preset17,
  'FFT Waveform GL': preset18,
  Switcher: preset19,
  'Position Field': preset20,
  'Torus Position Field': preset21,
  Add: preset22,
  Subtract: preset23,
  Difference: preset24,
  Composite: preset25,
  Over: preset26,
  Under: preset27,
  Threshold: preset28,
  'Chroma Key': preset29,
  'RGB Key': preset30,
  'Luma Key': preset31,
  Matte: preset32,
  'HSV Adjust': preset33,
  Monochrome: preset34,
  'Channel Mix': preset35,
  Limit: preset36,
  Remap: preset37,
  Lookup: preset38,
  'RGB to HSV': preset39,
  'HSV to RGB': preset40,
  'Tone Map': preset41,
  Fit: preset42,
  Flip: preset43,
  Mirror: preset44,
  Tile: preset45,
  'Lens Distort': preset46
};

export type { GLSLPreset } from './types';
