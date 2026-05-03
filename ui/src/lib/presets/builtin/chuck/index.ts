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
import { preset as preset11 } from './adsr-notes';
import { preset as preset12 } from './chirp-sweeps';
import { preset as preset13 } from './stereo-noise-pan';
import { preset as preset14 } from './oscillator-cloud';
import { preset as preset15 } from './rhodey-echo';
import { preset as preset16 } from './bitcrusher-delay';
import { preset as preset17 } from './pitch-shift-saw';
import { preset as preset18 } from './karplus-chord';
import { preset as preset19 } from './shakers-groove';
import { preset as preset20 } from './sitar-pattern';
import { preset as preset21 } from './bowed-strings';
import { preset as preset22 } from './brass-phrase';
import { preset as preset23 } from './flute-phrase';
import { preset as preset24 } from './wurley-drift';
import { preset as preset25 } from './tube-bells';

import type { ChuckPreset } from './types';

export const CHUCK_DEMO_PRESETS: Record<string, ChuckPreset> = {
  'bell.ck': preset0,
  'fm-siren.ck': preset1,
  'shepard-riser.ck': preset2,
  'mand-o-matic.ck': preset3,
  'resonant-noise.ck': preset4,
  'dtmf-dialer.ck': preset5,
  'chorus-pad.ck': preset6,
  'modal-mallets.ck': preset7,
  'moog-bass.ck': preset8,
  'chant-voice.ck': preset9,
  'wind-texture.ck': preset10,
  'adsr-notes.ck': preset11,
  'chirp-sweeps.ck': preset12,
  'stereo-noise-pan.ck': preset13,
  'oscillator-cloud.ck': preset14,
  'rhodey-echo.ck': preset15,
  'bitcrusher-delay.ck': preset16,
  'pitch-shift-saw.ck': preset17,
  'karplus-chord.ck': preset18,
  'shakers-groove.ck': preset19,
  'sitar-pattern.ck': preset20,
  'bowed-strings.ck': preset21,
  'brass-phrase.ck': preset22,
  'flute-phrase.ck': preset23,
  'wurley-drift.ck': preset24,
  'tube-bells.ck': preset25
};

export const CHUCK_DEMO_PRESET_KEYS = Object.keys(CHUCK_DEMO_PRESETS);

export type { ChuckPreset } from './types';
