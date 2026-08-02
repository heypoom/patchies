import type { ChuckPreset } from './types';

const code = `// Flute Phrase - adapted from ChucK examples/stk/flute.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 61 }

global int rootNote;
global float tempoMs;
global float outputGain;

61 => rootNote;
330 => tempoMs;
0.6 => outputGain;

Flute flute => PoleZero blocker => JCRev rev => dac;
0.99 => blocker.blockZero;
0.05 => rev.mix;
[0, 2, 4, 5, 7] @=> int notes[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  flute.clear(1.0);
  Math.random2f(0.1, 0.9) => flute.jetDelay;
  Math.random2f(0.1, 0.9) => flute.jetReflection;
  Math.random2f(0.1, 0.9) => flute.endReflection;
  Math.random2f(0.02, 0.35) => flute.noiseGain;
  Math.random2f(0.5, 7) => flute.vibratoFreq;
  Math.random2f(0, 0.25) => flute.vibratoGain;
  outputGain => flute.pressure;

  for (int i; i < notes.size(); i++) {
    rootNote + notes[i] => Std.mtof => flute.freq;
    Math.random2f(0.55, 0.85) => flute.noteOn;
    clamp(tempoMs, 100, 1500)::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Breathy randomized flute phrases using the STK Flute model.',
  data: { expr: code.trim() }
};
