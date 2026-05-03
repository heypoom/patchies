import type { ChuckPreset } from './types';

const code = `// FM Synthesis - adapted from ChucK examples/basic/fm.ck
// Patchies controls:
// { type: "set", key: "carrierHz", value: 220 }
// { type: "set", key: "modulatorHz", value: 550 }
// { type: "set", key: "modIndex", value: 180 }

global float carrierHz;
global float modulatorHz;
global float modIndex;
global float outputGain;

220 => carrierHz;
550 => modulatorHz;
180 => modIndex;
0.25 => outputGain;

SinOsc carrier => dac;
SinOsc modulator => blackhole;

fun float atLeast(float value, float floor) {
  if (value < floor) return floor;
  return value;
}

while (true) {
  atLeast(modulatorHz, 20) => modulator.freq;
  outputGain => carrier.gain;
  carrierHz + (modIndex * modulator.last()) => carrier.freq;
  1::samp => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Compact FM tone with Patchies-controllable carrier, modulator, and index.',
  data: { expr: code.trim() }
};
