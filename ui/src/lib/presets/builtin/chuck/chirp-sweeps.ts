import type { ChuckPreset } from './types';

const code = `// Chirp Sweeps - adapted from ChucK examples/basic/chirp.ck
// Patchies controls:
// { type: "set", key: "lowNote", value: 24 }
// { type: "set", key: "highNote", value: 96 }

global float lowNote;
global float highNote;
global float sweepMs;
global float outputGain;

24 => lowNote;
96 => highNote;
900 => sweepMs;
0.28 => outputGain;

SinOsc osc => NRev rev => dac;
0.06 => rev.mix;
outputGain => osc.gain;

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

fun void chirp(float source, float target, dur duration, dur tick) {
  source => float pitch;
  (duration / tick) $ int => int steps;
  (target - source) / steps => float inc;

  for (0 => int i; i < steps; i++) {
    pitch + inc => pitch;
    Std.mtof(pitch) => osc.freq;
    outputGain => osc.gain;
    tick => now;
  }
}

while (true) {
  clamp(sweepMs, 100, 4000)::ms => dur duration;
  chirp(lowNote, highNote, duration, 5::ms);
  120::ms => now;
  chirp(highNote, lowNote, duration * 0.7, 5::ms);
  250::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Rising and falling sine chirps for pitch-sweep gestures.',
  data: { expr: code.trim() }
};
