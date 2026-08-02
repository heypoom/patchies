import { preset as preset0 } from './passthru';
import { preset as preset1 } from './point-cloud-from-texture';
import { preset as preset2 } from './bloom';
import { preset as preset3 } from './cache';
import { preset as preset4 } from './time-scrub';
import { preset as preset5 } from './time-machine';
import { preset as preset6 } from './layout';
import { preset as preset7 } from './layer';
import { preset as preset8 } from './motion-flow';
import type { REGLPreset } from './types';

export const REGL_PRESETS: Record<string, REGLPreset> = {
  'regl>': preset0,
  'point-cloud-from-texture.regl': preset1,
  Bloom: preset2,
  Cache: preset3,
  'Time Scrub': preset4,
  'Time Machine': preset5,
  Layout: preset6,
  Layer: preset7,
  'Motion Flow': preset8
};
