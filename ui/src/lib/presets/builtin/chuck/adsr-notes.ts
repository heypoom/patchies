import type { ChuckPreset } from './types';

const code = `// ADSR Notes - adapted from ChucK examples/basic/adsr.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 48 }
// { type: "set", key: "tempoMs", value: 650 }

global int rootNote;
global float tempoMs;
global float outputGain;

48 => rootNote;
650 => tempoMs;
0.35 => outputGain;

SinOsc osc => ADSR env => dac;
env.set(10::ms, 80::ms, 0.45, 450::ms);
[0, 2, 3, 7, 9, 12] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  rootNote + scale[Math.random2(0, scale.size() - 1)] + Math.random2(0, 2) * 12 => Std.mtof => osc.freq;
  outputGain => osc.gain;

  env.keyOn();
  clamp(tempoMs, 80, 2000) * 0.65 => float holdMs;
  holdMs::ms => now;

  env.keyOff();
  env.releaseTime() => now;
  clamp(tempoMs, 80, 2000) * 0.35 => float restMs;
  restMs::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Simple random sine notes shaped with an ADSR envelope.',
  data: { expr: code.trim() }
};
