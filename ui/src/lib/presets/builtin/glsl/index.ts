import { preset as preset0 } from './passthru';
import { preset as preset1 } from './mix';
import { preset as preset2 } from './constant';
import { preset as preset3 } from './linear-ramp';
import { preset as preset4 } from './radial-ramp';
import { preset as preset5 } from './circular-ramp';
import { preset as preset6 } from './level';
import { preset as preset7 } from './transform';
import { preset as preset8 } from './overlay';
import { preset as preset9 } from './multiply';
import { preset as preset10 } from './blur';
import { preset as preset11 } from './crop';
import { preset as preset12 } from './reorder';
import { preset as preset13 } from './displace';
import { preset as preset14 } from './edge';
import { preset as preset15 } from './noise';
import { preset as preset16 } from './noise-displace';
import { preset as preset17 } from './feedback';
import { preset as preset18 } from './fft-frequency';
import { preset as preset19 } from './fft-waveform';
import { preset as preset20 } from './switcher';
import { preset as preset21 } from './position-field';
import { preset as preset22 } from './torus-position-field';
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
  Overlay: preset8,
  Multiply: preset9,
  Blur: preset10,
  Crop: preset11,
  Reorder: preset12,
  Displace: preset13,
  Edge: preset14,
  Noise: preset15,
  'Noise Displace': preset16,
  Feedback: preset17,
  'FFT Frequency GL': preset18,
  'FFT Waveform GL': preset19,
  Switcher: preset20,
  'Position Field': preset21,
  'Torus Position Field': preset22
};

export type { GLSLPreset } from './types';
