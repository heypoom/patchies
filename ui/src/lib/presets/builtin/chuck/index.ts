import { preset as preset0 } from './bell';
import { preset as preset1 } from './fm-siren';
import { preset as preset2 } from './shepard-riser';
import { preset as preset3 } from './mand-o-matic';
import { preset as preset4 } from './resonant-noise';
import { preset as preset5 } from './dtmf-dialer';

import type { ChuckPreset } from './types';

export const CHUCK_DEMO_PRESETS: Record<string, ChuckPreset> = {
  'bell.chuck': preset0,
  'fm-siren.chuck': preset1,
  'shepard-riser.chuck': preset2,
  'mand-o-matic.chuck': preset3,
  'resonant-noise.chuck': preset4,
  'dtmf-dialer.chuck': preset5
};

export type { ChuckPreset } from './types';
