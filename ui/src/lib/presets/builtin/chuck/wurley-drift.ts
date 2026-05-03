import type { ChuckPreset } from './types';

const code = `// Wurley Drift - adapted from ChucK examples/stk/wurley.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 45 }

global int rootNote;
global float outputGain;

45 => rootNote;
0.8 => outputGain;

Wurley keys => JCRev rev => dac;
0.1 => rev.mix;
[0, 3, 7, 8, 11] @=> int scale[];

while (true) {
  rootNote + Math.random2(0, 1) * 12 + scale[Math.random2(0, scale.size() - 1)] => Std.mtof => keys.freq;
  outputGain => keys.gain;
  Math.random2f(0.55, 0.8) => keys.noteOn;

  if (Math.randomf() > 0.9) {
    repeat (100) {
      keys.freq() * 1.01 => keys.freq;
      10::ms => now;
    }
  } else if (Math.randomf() > 0.75) {
    repeat (50) {
      keys.freq() * 0.99 => keys.freq;
      10::ms => now;
    }
  } else {
    250::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Electric-piano tones with occasional pitch drift gestures.',
  data: { expr: code.trim() }
};
