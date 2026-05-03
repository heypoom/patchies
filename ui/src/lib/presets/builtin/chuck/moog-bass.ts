import type { ChuckPreset } from './types';

const code = `// Moog Bass - adapted from ChucK examples/stk/moog.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 33 }
// { type: "set", key: "tempoMs", value: 180 }

global int rootNote;
global float tempoMs;
global float filterQ;
global float lfoDepth;
global float outputGain;

33 => rootNote;
180 => tempoMs;
0.45 => filterQ;
0.25 => lfoDepth;
0.65 => outputGain;

Moog moog => NRev rev => dac;
0.04 => rev.mix;
[0, 2, 3, 5, 7, 10] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  clamp(filterQ, 0, 1) => moog.filterQ;
  Math.random2f(0.1, 0.9) => moog.filterSweepRate;
  Math.random2f(0.5, 6) => moog.lfoSpeed;
  clamp(lfoDepth, 0, 1) => moog.lfoDepth;
  clamp(outputGain, 0, 1) => moog.volume;

  scale[Math.random2(0, scale.size() - 1)] => int degree;
  rootNote + Math.random2(0, 1) * 12 + degree => Std.mtof => moog.freq;
  0.8 => moog.noteOn;

  clamp(tempoMs, 60, 1500)::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Generative Moog-style bass line with filter and LFO motion.',
  data: { expr: code.trim() }
};
