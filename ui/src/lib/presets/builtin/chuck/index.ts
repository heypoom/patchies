import { preset as preset0 } from './bell';
import { preset as preset1 } from './fm-siren';
import { preset as preset2 } from './shepard-riser';
import { preset as preset3 } from './mand-o-matic';
import { preset as preset4 } from './resonant-noise';
import { preset as preset5 } from './dtmf-dialer';
import { preset as preset6 } from './chorus-pad';
import { preset as preset7 } from './modal-mallets';
import { preset as preset8 } from './moog-bass';
import { preset as preset9 } from './chant-voice';
import { preset as preset10 } from './wind-texture';

import type { ChuckPreset } from './types';

export const CHUCK_DEMO_PRESETS: Record<string, ChuckPreset> = {
  'bell.chuck': preset0,
  'fm-siren.chuck': preset1,
  'shepard-riser.chuck': preset2,
  'mand-o-matic.chuck': preset3,
  'resonant-noise.chuck': preset4,
  'dtmf-dialer.chuck': preset5,
  'chorus-pad.chuck': preset6,
  'modal-mallets.chuck': preset7,
  'moog-bass.chuck': preset8,
  'chant-voice.chuck': preset9,
  'wind-texture.chuck': preset10
};

export const CHUCK_DEMO_PRESET_KEYS = Object.keys(CHUCK_DEMO_PRESETS);

export type { ChuckPreset } from './types';
