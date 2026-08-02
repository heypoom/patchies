import type { ChuckPreset } from './types';

const code = `// Oscillator Cloud - adapted from ChucK examples/basic/oscillatronx.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 60 }
// { type: "set", key: "tempoMs", value: 250 }

global int rootNote;
global float tempoMs;
global float outputGain;

60 => rootNote;
250 => tempoMs;
0.55 => outputGain;

[0, 2, 4, 7, 9] @=> int scale[];

SinOsc sine => dac;
SawOsc saw => dac;
TriOsc tri => dac;
PulseOsc pulse => dac;
SqrOsc square => dac;
TriOsc fmMod => SinOsc fmCarrier => dac;

2 => fmCarrier.sync;
100 => fmMod.gain;
[sine, saw, tri, pulse, square, fmMod] @=> Osc oscillators[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  outputGain * 0.18 => sine.gain;
  outputGain * 0.09 => saw.gain;
  outputGain * 0.09 => tri.gain;
  outputGain * 0.09 => pulse.gain;
  outputGain * 0.09 => square.gain;
  outputGain * 0.09 => fmCarrier.gain;

  Math.random2(0, 7) => int selected;
  if (selected > 5) 5 => selected;

  rootNote + scale[Math.random2(0, scale.size() - 1)] => Std.mtof => float note;
  note => oscillators[selected].freq;

  repeat (10) {
    Math.random2f(0.2, 0.8) => fmMod.width;
    clamp(tempoMs, 60, 1500) * 0.2 => float waitMs;
    waitMs::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'A shifting cloud of sine, saw, triangle, pulse, square, and FM tones.',
  data: { expr: code.trim() }
};
