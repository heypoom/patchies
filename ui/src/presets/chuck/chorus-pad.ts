import type { ChuckPreset } from './types';

const code = `// Chorus Pad - adapted from ChucK examples/effects/chorus.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 50 }
// { type: "set", key: "chorusMix", value: 0.25 }

global int rootNote;
global float chorusMix;
global float modDepth;
global float modFreq;
global float outputGain;

50 => rootNote;
0.25 => chorusMix;
0.4 => modDepth;
0.6 => modFreq;
0.16 => outputGain;

SinOsc voice[4];
Chorus chorus[4];
[0, 3, 7, 10] @=> int chord[];

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

fun float atLeast(float value, float floor) {
  if (value < floor) return floor;
  return value;
}

for (int i; i < voice.size(); i++) {
  voice[i] => chorus[i] => dac;
  10::ms => chorus[i].baseDelay;
}

while (true) {
  for (int i; i < voice.size(); i++) {
    rootNote + chord[i] => Std.mtof => voice[i].freq;
    outputGain => voice[i].gain;
    clamp(chorusMix, 0, 1) => chorus[i].mix;
    clamp(modDepth, 0, 1) => chorus[i].modDepth;
    atLeast(modFreq, 0.01) => chorus[i].modFreq;
  }

  20::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Warm four-voice sine pad with a controllable chorus shimmer.',
  data: { expr: code.trim() }
};
