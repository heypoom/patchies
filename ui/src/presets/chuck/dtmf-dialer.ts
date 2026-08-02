import type { ChuckPreset } from './types';

const code = `// DTMF Dialer - adapted from ChucK examples/deep/dtmf.ck
// Patchies controls:
// { type: "set", key: "digit", value: 5 } // -1 keeps random dialing
// { type: "set", key: "toneMs", value: 100 }

global int digit;
global float toneMs;
global float outputGain;

-1 => digit;
100 => toneMs;
0.3 => outputGain;

SinOsc row => dac;
SinOsc col => dac;

[1209.0, 1336.0, 1477.0] @=> float cols[];
[697.0, 770.0, 852.0, 941.0] @=> float rows[];

fun int key2col(int key) {
  if (!key) return 1;
  return (key - 1) % 3;
}

fun int key2row(int key) {
  if (!key) return 3;
  return (key - 1) / 3;
}

fun float atLeast(float value, float floor) {
  if (value < floor) return floor;
  return value;
}

while (true) {
  digit => int key;
  if (key < 0 || key > 9) Math.random2(0, 9) => key;

  key2row(key) => int r;
  key2col(key) => int c;
  rows[r] => row.freq;
  cols[c] => col.freq;
  outputGain => row.gain;
  outputGain => col.gain;
  <<< "dtmf", key >>>;

  atLeast(toneMs, 40) => float safeToneMs;
  safeToneMs::ms => now;
  0 => row.gain;
  0 => col.gain;
  atLeast(toneMs * 0.5, 25) => float restMs;
  restMs::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Playful dual-tone telephone dialer with random or fixed digits.',
  data: { expr: code.trim() }
};
