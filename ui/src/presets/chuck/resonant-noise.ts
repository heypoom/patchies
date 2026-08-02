import type { ChuckPreset } from './types';

const code = `// Resonant Noise - adapted from ChucK examples/filter/resonz.ck
// Patchies controls:
// { type: "set", key: "sweepRate", value: 1.0 }
// { type: "set", key: "maxFreq", value: 5000 }
// { type: "set", key: "filterQ", value: 2 }

global float sweepRate;
global float maxFreq;
global float filterQ;
global float outputGain;

1.0 => sweepRate;
5000 => maxFreq;
2 => filterQ;
0.2 => outputGain;

Noise noise => ResonZ filter => dac;

fun float atLeast(float value, float floor) {
  if (value < floor) return floor;
  return value;
}

while (true) {
  atLeast(filterQ, 0.05) => filter.Q;
  outputGain => noise.gain;
  100 + Math.fabs(Math.sin(now / second * sweepRate)) * atLeast(maxFreq, 100) => filter.freq;
  5::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Sweeping resonant noise texture with controllable rate, range, and Q.',
  data: { expr: code.trim() }
};
