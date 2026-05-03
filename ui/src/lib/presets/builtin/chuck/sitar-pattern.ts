import type { ChuckPreset } from './types';

const code = `// Sitar Pattern - adapted from ChucK examples/stk/sitar.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 57 }

global int rootNote;
global float tempoMs;
global float outputGain;

57 => rootNote;
300 => tempoMs;
0.85 => outputGain;

Sitar sitar => PRCRev rev => dac;
0.05 => rev.mix;
[0, 2, 4, 7, 9, 11] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  rootNote + Math.random2(0, 2) * 12 + scale[Math.random2(0, scale.size() - 1)] => Std.mtof => sitar.freq;
  Math.random2f(0.4, 0.9) * outputGain => sitar.noteOn;
  clamp(tempoMs, 80, 1600)::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'A bright randomized sitar pluck pattern with light reverb.',
  data: { expr: code.trim() }
};
