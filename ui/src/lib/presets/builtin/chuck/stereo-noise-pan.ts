import type { ChuckPreset } from './types';

const code = `// Stereo Noise Pan - adapted from ChucK examples/stereo/stereo-noise.ck
// Patchies controls:
// { type: "set", key: "panRate", value: 2.5 }

global float panRate;
global float outputGain;

2.5 => panRate;
0.09 => outputGain;

Noise noise => Pan2 pan => dac;
0.0 => float t;
10::ms => dur T;

1::second => now;

while (true) {
  outputGain => noise.gain;
  Math.sin(t) => pan.pan;
  T / second * panRate +=> t;
  T => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'White noise moving across the stereo field.',
  data: { expr: code.trim() }
};
