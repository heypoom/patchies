import type { ChuckPreset } from './types';

const code = `// Rhodey Echo - adapted from ChucK examples/stk/rhodey.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 33 }
// { type: "set", key: "echoMix", value: 0.35 }

global int rootNote;
global float echoMix;
global float outputGain;

33 => rootNote;
0.35 => echoMix;
0.75 => outputGain;

Rhodey keys => JCRev rev => Echo echoA => Echo echoB => Echo echoC => dac;
0.16 => rev.mix;
1000::ms => echoA.max => echoB.max => echoC.max;
750::ms => echoA.delay => echoB.delay => echoC.delay;
[0, 2, 4, 7, 9] @=> int scale[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

spork ~ moveEcho();

while (true) {
  scale[Math.random2(0, scale.size() - 1)] => int degree;
  rootNote + Math.random2(0, 1) * 12 + degree => Std.mtof => keys.freq;
  outputGain => keys.gain;
  Math.random2f(0.6, 0.85) => keys.noteOn;

  if (Math.randomf() > 0.85) 1000::ms => now;
  else if (Math.randomf() > 0.85) 500::ms => now;
  else if (Math.randomf() > 0.1) 250::ms => now;
  else {
    2 * Math.random2(1, 3) => int pick;
    0 => int pickDir;

    for (0 => int i; i < pick; i++) {
      Math.random2f(0.4, 0.6) + i * 0.035 - 0.02 * (i * pickDir) => keys.noteOn;
      !pickDir => pickDir;
      250::ms => now;
    }
  }
}

fun void moveEcho() {
  0.0 => float currentMix;

  while (true) {
    clamp(echoMix, 0, 1) => float targetMix;
    (targetMix - currentMix) / 500.0 => float inc;

    repeat (500) {
      inc +=> currentMix;
      currentMix => echoA.mix => echoB.mix => echoC.mix;
      1::ms => now;
    }

    Math.random2(2, 6)::second => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Electric-piano fragments drifting through a moving echo chain.',
  data: { expr: code.trim() }
};
