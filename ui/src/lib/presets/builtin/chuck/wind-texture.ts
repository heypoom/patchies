import type { ChuckPreset } from './types';

const code = `// Wind Texture - adapted from ChucK examples/basic/wind2.ck
// Patchies controls:
// { type: "set", key: "sweepDepth", value: 12000 }
// { type: "set", key: "gainRate", value: 0.001 }

global float sweepDepth;
global float sweepRate;
global float gainRate;
global float outputGain;

12000 => sweepDepth;
0.01 => sweepRate;
0.001 => gainRate;
0.18 => outputGain;

Noise noise => BiQuad filter => dac;
0.99 => filter.prad;
0.05 => filter.gain;
1 => filter.eqzs;

0.0 => float sweepPhase;
0.0 => float gainPhase;

spork ~ breathe();

fun float atLeast(float value, float floor) {
  if (value < floor) return floor;
  return value;
}

while (true) {
  120.0 + Std.fabs(Math.sin(sweepPhase)) * atLeast(sweepDepth, 100) => filter.pfreq;
  sweepRate +=> sweepPhase;
  60::ms => now;
}

fun void breathe() {
  while (true) {
    Std.fabs(Math.sin(gainPhase)) * outputGain => noise.gain;
    gainRate +=> gainPhase;
    10::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Breathing wind-like noise texture with slow resonant motion.',
  data: { expr: code.trim() }
};
