import type { ChuckPreset } from './types';

const code = `// Bitcrusher Delay - adapted from ChucK examples/effects/Bitcrusher.ck
// Patchies controls:
// { type: "set", key: "bits", value: 5 }
// { type: "set", key: "downsample", value: 12 }

global int bits;
global int downsample;
global float delayMs;
global float outputGain;

5 => bits;
12 => downsample;
420 => delayMs;
0.28 => outputGain;

class LocalBitcrusher extends Chugen {
  0.0 => float held;
  0 => int countdown;

  fun float tick(float input) {
    if (countdown <= 0) {
      bits => int safeBits;
      if (safeBits < 1) 1 => safeBits;
      if (safeBits > 16) 16 => safeBits;

      downsample => int safeDownsample;
      if (safeDownsample < 1) 1 => safeDownsample;
      if (safeDownsample > 128) 128 => safeDownsample;

      Math.pow(2, safeBits) => float levels;
      ((input * levels) $ int) / levels => held;
      safeDownsample => countdown;
    }

    1 -=> countdown;
    return held;
  }
}

SawOsc source => Delay delay => LocalBitcrusher crusher => Gain out => dac;
0.5::second => delay.max;
110 => source.freq;

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  outputGain => source.gain;
  clamp(delayMs, 20, 500)::ms => delay.delay;
  1 => out.gain;
  50::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'A saw tone through WebChucK-safe local bitcrushing and a short delay.',
  data: { expr: code.trim() }
};
