import { preset as checker } from './checker';
import { preset as counter } from './counter';
import { preset as prng } from './prng';
import { preset as sprite } from './sprite';

export const UXN_DEMO_PRESETS = {
  'checker.tal': checker,
  'counter.tal': counter,
  'prng.tal': prng,
  'sprite.tal': sprite
};

export const UXN_DEMO_PRESET_KEYS = Object.keys(UXN_DEMO_PRESETS);

export type { UxnPreset } from './types';
