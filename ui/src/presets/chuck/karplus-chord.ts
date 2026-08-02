import type { ChuckPreset } from './types';

const code = `// Karplus Chord - adapted from ChucK examples/deep/ks-chord.ck
// Patchies controls:
// { type: "set", key: "rootNote", value: 48 }
// { type: "set", key: "tempoMs", value: 520 }

global int rootNote;
global float tempoMs;
global float feedback;
global float outputGain;

48 => rootNote;
520 => tempoMs;
0.95 => feedback;
0.45 => outputGain;

class KS extends Chugraph {
  second / samp => float sampleRate;
  DelayA delay;
  OneZero lowpass;
  Noise noise => delay;
  0 => noise.gain;
  inlet => delay => lowpass => delay => outlet;
  1::second => delay.max;
  -1 => lowpass.zero;
  0.9 => lowpass.gain;

  fun void pluck(float pitch, dur T) {
    tune(pitch) => float length;
    1 => noise.gain;
    length::samp => now;
    0 => noise.gain;
    T - length::samp => now;
  }

  fun float tune(float pitch) {
    pitch - 43 => float diff;
    0 => float adjust;
    if (diff > 0) diff * 0.0125 => adjust;
    sampleRate / Std.mtof(pitch + adjust) => float length;
    length::samp => delay.delay;
    return length;
  }

  fun float setFeedback(float amount) {
    if (amount >= 1 || amount < 0) return lowpass.gain();
    amount => lowpass.gain;
    return amount;
  }
}

KS voices[4];
Gain master => NRev rev => dac;
0.08 => rev.mix;
[0, 4, 7, 12] @=> int chord[];

for (int i; i < voices.size(); i++) {
  voices[i] => master;
}

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  outputGain => master.gain;

  for (int i; i < voices.size(); i++) {
    voices[i].setFeedback(clamp(feedback, 0.1, 0.995));
    spork ~ voices[i].pluck(rootNote + chord[i], 450::ms);
    35::ms => now;
  }

  clamp(tempoMs, 120, 2500)::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Four-voice Karplus-Strong chord pings with resonant decay.',
  data: { expr: code.trim() }
};
