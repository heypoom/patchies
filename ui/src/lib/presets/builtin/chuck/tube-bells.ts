import type { ChuckPreset } from './types';

const code = `// Tube Bells - adapted from ChucK examples/stk/tubebell-algo5.ck
// Patchies controls:
// { type: "set", key: "tempoMs", value: 200 }

global float tempoMs;
global float outputGain;

200 => tempoMs;
0.6 => outputGain;

Gain mixer[2] => NRev rev[2] => dac;
9 => int numBells;
TubeBell bell[numBells];
Pan2 pan[numBells];

for (int i; i < numBells; i++) {
  bell[i] => pan[i] => mixer;
  bell[i].opADSR(0, 0.01, 0.4, 0.0, 0.04);
  bell[i].opADSR(2, 0.01, 0.4, 0.0, 0.04);
  -1.0 + 0.25 * i => pan[i].pan;
}

TubeBell bassBell => Pan2 bassPan => mixer;
0.05 => rev[0].mix => rev[1].mix;
bell => Delay delay => Pan2 delayPan => rev;
delay => delay;
0.45 => delay.gain;
2::second => delay.max;
0.35::second => delay.delay;

[64, 72, 64, 74, 64, 71, 72, 64, 71, 64, 69, 64, 71, 64, 67, 69] @=> int patternA[];
[64, 72, 64, 74, 64, 71, 72, 64, 69, 64, 71, 64, 67, 69] @=> int patternB[];
0 => int round;

fun float clamp(float value, float low, float high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

while (true) {
  if (Math.randomf() > 0.5) playPattern(patternA);
  else playPattern(patternB);
}

fun void playPattern(int pattern[]) {
  if (Math.randomf() > 0.82) {
    110 => bassBell.freq;
    outputGain => bassBell.noteOn;
  }

  for (0 => int i; i < pattern.size(); i++) {
    Std.mtof(pattern[i]) => bell[round].freq;
    outputGain => bell[round].noteOn;
    round++;
    if (round == numBells) 0 => round;
    clamp(tempoMs, 80, 1000)::ms => now;
  }
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Round-robin FM tube bells playing a bright repeating pattern.',
  data: { expr: code.trim() }
};
