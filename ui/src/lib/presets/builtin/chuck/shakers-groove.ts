import type { ChuckPreset } from './types';

const code = `// Shakers Groove - adapted from ChucK examples/stk/shake-o-matic.ck
// Patchies controls:
// { type: "set", key: "tempoMs", value: 125 }
// { type: "set", key: "instrument", value: -1 } // -1 randomizes

global float tempoMs;
global int instrument;
global float outputGain;

125 => tempoMs;
-1 => instrument;
0.75 => outputGain;

Shakers shaker => JCRev rev => dac;
0.025 => rev.mix;

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  if (instrument >= 0) instrument => shaker.which;
  else if (Math.randomf() > 0.625) Math.random2(0, 22) => shaker.which;

  Std.mtof(Math.random2f(24, 96)) => shaker.freq;
  Math.random2f(4, 96) => shaker.objects;
  Math.random2f(0.55, 1.0) * outputGain => shaker.noteOn;

  clamp(tempoMs, 45, 1000)::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Randomized STK shaker percussion with quick groove timing.',
  data: { expr: code.trim() }
};
