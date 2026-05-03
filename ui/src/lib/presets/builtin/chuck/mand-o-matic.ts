import type { ChuckPreset } from './types';

const code = `// Mand-o-matic - adapted from ChucK examples/stk/mand-o-matic-simple.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 45 }
// { type: "set", key: "tempoMs", value: 125 }
// { type: "set", key: "reverbMix", value: 0.05 }

global int rootNote;
global float tempoMs;
global float reverbMix;
global float outputGain;

45 => rootNote;
125 => tempoMs;
0.05 => reverbMix;
0.75 => outputGain;

Mandolin mand => JCRev reverb => dac;
outputGain => reverb.gain;
[0, 2, 4, 7, 9] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  Math.random2f(0.2, 0.8) => mand.pluckPos;
  rootNote + Math.random2(0, 3) * 12 + scale[Math.random2(0, scale.size() - 1)] => Std.mtof => mand.freq;
  Math.random2f(0.2, 0.9) => mand.pluck;
  clamp(reverbMix, 0, 1) => reverb.mix;
  outputGain => reverb.gain;

  clamp(tempoMs, 35, 2000) => float stepMs;
  if (Math.random2f(0, 1) > 0.95) {
    stepMs * 4 => float waitMs;
    waitMs::ms => now;
  }
  else if (Math.random2f(0, 1) > 0.95) {
    stepMs * 2 => float waitMs;
    waitMs::ms => now;
  }
  else if (Math.random2f(0, 1) > 0.05) stepMs::ms => now;
  else {
    4 * Math.random2(1, 5) => int pick;
    0.7 / pick => float inc;
    1 => int pickDir;

    for (1 => int i; i < pick; i++) {
      stepMs * 0.6 => float waitMs;
      waitMs::ms => now;
      Math.random2f(0.2, 0.3) + i * inc + -0.2 * pickDir => mand.pluck;
      !pickDir => pickDir;
    }

    stepMs * 0.6 => float waitMs;
    waitMs::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Generative plucked-string pattern with controllable root, tempo, and reverb.',
  data: { expr: code.trim() }
};
