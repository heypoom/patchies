import type { ChuckPreset } from './types';

const code = `// Bowed Strings - adapted from ChucK examples/stk/bowed.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 57 }

global int rootNote;
global float noteSeconds;
global float outputGain;

57 => rootNote;
1.2 => noteSeconds;
0.55 => outputGain;

Bowed bow => NRev rev => dac;
0.06 => rev.mix;
[0, 2, 4, 7, 8, 11] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  Math.random2f(0.2, 0.8) => bow.bowPressure;
  Math.random2f(0.15, 0.85) => bow.bowPosition;
  Math.random2f(0.2, 6) => bow.vibratoFreq;
  Math.random2f(0, 0.25) => bow.vibratoGain;
  outputGain => bow.volume;

  rootNote + scale[Math.random2(0, scale.size() - 1)] => Std.mtof => bow.freq;
  0.8 => bow.noteOn;
  clamp(noteSeconds, 0.2, 5)::second => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Slow randomized bowed-string tones with light vibrato.',
  data: { expr: code.trim() }
};
