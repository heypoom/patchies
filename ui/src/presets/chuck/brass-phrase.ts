import type { ChuckPreset } from './types';

const code = `// Brass Phrase - adapted from ChucK examples/stk/brass.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 61 }

global int rootNote;
global float tempoMs;
global float outputGain;

61 => rootNote;
300 => tempoMs;
0.65 => outputGain;

Brass brass => JCRev rev => dac;
0.05 => rev.mix;
[0, 2, 4, 5, 7] @=> int notes[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  Math.random2f(0.1, 0.9) => brass.lip;
  Math.random2f(0.1, 0.9) => brass.slide;
  Math.random2f(0.5, 8) => brass.vibratoFreq;
  Math.random2f(0, 0.3) => brass.vibratoGain;
  outputGain => brass.volume;

  for (int i; i < notes.size(); i++) {
    rootNote + notes[i] => Std.mtof => brass.freq;
    Math.random2f(0.55, 0.85) => brass.noteOn;
    clamp(tempoMs, 80, 1200)::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Short physical-model brass phrases with randomized tone color.',
  data: { expr: code.trim() }
};
