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
import { preset as preset33 } from './mask';
import { preset as preset34 } from './hsv-adjust';
import { preset as preset35 } from './monochrome';
import { preset as preset36 } from './channel-mix';
import { preset as preset37 } from './limit';
import { preset as preset38 } from './remap';
import { preset as preset39 } from './lookup';
import { preset as preset40 } from './rgb-to-hsv';
import { preset as preset41 } from './hsv-to-rgb';
import { preset as preset42 } from './tone-map';
import { preset as preset43 } from './fit';
import { preset as preset44 } from './flip';
import { preset as preset45 } from './mirror';
import { preset as preset46 } from './tile';
import { preset as preset47 } from './lens-distort';
import { preset as preset48 } from './circle';
import { preset as preset49 } from './rectangle';
import { preset as preset50 } from './cross';
import { preset as preset51 } from './emboss';
import { preset as preset52 } from './slope';
import { preset as preset53 } from './normal-map';
import { preset as preset54 } from './anti-alias';
import { preset as preset55 } from './luma-blur';
import { preset as preset56 } from './luma-level';
import { preset as preset57 } from './pack';
import { preset as preset58 } from './convolve';
import { preset as preset59 } from './math';
import { preset as preset60 } from './chromatic-aberration';
import { preset as preset61 } from './blob-detect';
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
  Mask: preset33,
  'HSV Adjust': preset34,
  Monochrome: preset35,
  'Channel Mix': preset36,
  Limit: preset37,
  Remap: preset38,
  Lookup: preset39,
  'RGB to HSV': preset40,
  'HSV to RGB': preset41,
  'Tone Map': preset42,
  Fit: preset43,
  Flip: preset44,
  Mirror: preset45,
  Tile: preset46,
  'Lens Distort': preset47,
  Circle: preset48,
  Rectangle: preset49,
  Cross: preset50,
  Emboss: preset51,
  Slope: preset52,
  'Normal Map': preset53,
  'Anti Alias': preset54,
  'Luma Blur': preset55,
  'Luma Level': preset56,
  Pack: preset57,
  Convolve: preset58,
  Math: preset59,
  'Chromatic Aberration': preset60,
  'Blob Detect': preset61
};

export type { GLSLPreset } from './types';
