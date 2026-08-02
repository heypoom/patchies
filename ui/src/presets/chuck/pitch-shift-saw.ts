import type { ChuckPreset } from './types';

const code = `// Pitch Shift Saw - adapted from ChucK examples/effects/pitch-shift.ck
// Patchies controls:
// { type: "set", key: "shiftDepth", value: 2.5 }
// { type: "set", key: "sweepMs", value: 40 }

global float shiftDepth;
global float sweepMs;
global float mix;
global float outputGain;

2.5 => shiftDepth;
40 => sweepMs;
0.55 => mix;
0.18 => outputGain;

SawOsc saw => PitShift shift => dac;
110 => saw.freq;

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  outputGain => saw.gain;
  clamp(mix, 0, 1) => shift.mix;
  clamp(shiftDepth, 0.1, 5) => float depth;
  clamp(sweepMs, 10, 400)::ms => dur step;

  for (-100 => int i; i <= 100; i++) {
    (i / 100.0) * depth => shift.shift;
    step => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Saw oscillator swept through a delay-line pitch shifter.',
  data: { expr: code.trim() }
};
