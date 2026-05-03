import type { ChuckPreset } from './types';

const code = `// Modal Mallets - adapted from ChucK examples/stk/modalbar.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 57 }
// { type: "set", key: "tempoMs", value: 250 }
// { type: "set", key: "barPreset", value: 3 }

global int rootNote;
global float tempoMs;
global int barPreset;
global float outputGain;

57 => rootNote;
250 => tempoMs;
-1 => barPreset;
0.55 => outputGain;

ModalBar bar => NRev rev => dac;
0.08 => rev.mix;
[0, 2, 4, 7, 8, 11] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  if (barPreset >= 0) barPreset => bar.preset;
  else Math.random2(0, 8) => bar.preset;

  Math.random2f(0.15, 0.95) => bar.stickHardness;
  Math.random2f(0.1, 0.9) => bar.strikePosition;
  Math.random2f(0, 0.45) => bar.vibratoGain;
  Math.random2f(0, 18) => bar.vibratoFreq;
  outputGain => bar.volume;
  0.8 => bar.directGain;
  0.8 => bar.masterGain;

  scale[Math.random2(0, scale.size() - 1)] => int degree;
  rootNote + Math.random2(0, 2) * 12 + degree => Std.mtof => bar.freq;
  0.8 => bar.noteOn;

  clamp(tempoMs, 60, 2000)::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Generative metallic mallets using the STK ModalBar model.',
  data: { expr: code.trim() }
};
