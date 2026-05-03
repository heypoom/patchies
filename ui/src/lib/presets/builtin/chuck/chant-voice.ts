import type { ChuckPreset } from './types';

const code = `// Chant Voice - adapted from ChucK examples/deep/chant.ck
// Source-filter vocal synthesis with concurrent shreds.

global float outputGain;
global float vibratoAmount;

0.22 => outputGain;
0.0001 => vibratoAmount;

Impulse impulse => TwoZero tiltA => TwoZero tiltB => OnePole pole;
pole => TwoPole formantA => Gain voice;
pole => TwoPole formantB => voice;
pole => TwoPole formantC => voice;
voice => Gain master => JCRev reverb => dac;

outputGain => master.gain;
0.04 => reverb.mix;

1.0 => tiltA.b0;
0.0 => tiltA.b1;
-1.0 => tiltA.b2;
1.0 => tiltB.b0;
0.0 => tiltB.b1;
1.0 => tiltB.b2;

0.997 => formantA.radius;
0.997 => formantB.radius;
0.997 => formantC.radius;
1.0 => formantA.gain;
0.8 => formantB.gain;
0.6 => formantC.gain;

0.99 => pole.pole;
1.0 => pole.gain;

400.0 => float f1;
1000.0 => float f2;
2800.0 => float f3;
400.0 => float targetF1;
1000.0 => float targetF2;
2800.0 => float targetF3;

0.013 => float period;
0.013 => float targetPeriod;
0.0 => float modphase;

[0, 1, 5, 7, 8, 11, 8, 7, 11, 12, 14, 15, 19, 17, 20, 24] @=> int scale[];
9 => int scalePoint;

spork ~ singSource();
spork ~ interpolate(10::ms);

while (true) {
  Math.random2f(230.0, 660.0) => targetF1;
  Math.random2f(800.0, 2300.0) => targetF2;
  Math.random2f(1700.0, 3000.0) => targetF3;

  Math.random2(-1, 1) +=> scalePoint;
  if (scalePoint < 0) 0 => scalePoint;
  if (scalePoint > 15) 15 => scalePoint;

  32 + scale[scalePoint] => Std.mtof => float noteFreq;
  1.0 / noteFreq => targetPeriod;
  Math.random2f(0.2, 0.9)::second => now;
}

fun void singSource() {
  while (true) {
    outputGain => master.gain;
    0.25 => impulse.next;
    period +=> modphase;
    (period + vibratoAmount * Math.sin(2 * pi * modphase * 6.0))::second => now;
  }
}

fun void interpolate(dur T) {
  0.10 => float slew;

  while (true) {
    (targetPeriod - period) * slew + period => period;
    (targetF1 - f1) * slew + f1 => f1 => formantA.freq;
    (targetF2 - f2) * slew + f2 => f2 => formantB.freq;
    (targetF3 - f3) * slew + f3 => f3 => formantC.freq;
    T => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Evolving source-filter chant voice built from concurrent ChucK shreds.',
  data: { expr: code.trim() }
};
