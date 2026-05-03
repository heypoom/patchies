import type { ChuckPreset } from './types';

const code = `// Shepard-Risset tone - adapted from ChucK examples/deep/shepard.ck
// Patchies controls:
// { type: "set", key: "speed", value: 0.004 }
// { type: "set", key: "direction", value: 1 } // 1 rises, -1 falls

global float speed;
global int direction;
global float outputGain;

0.004 => speed;
1 => direction;
0.45 => outputGain;

66 => float MU;
42 => float SIGMA;
1 / Math.gauss(MU, MU, SIGMA) => float SCALE;
[12.0, 24, 36, 48, 60, 72, 84, 96, 108] @=> float pitches[];
pitches.size() => int N;

TriOsc tones[N];
Gain gain => dac;
for (int i; i < N; i++) {
  tones[i] => gain;
}

while (true) {
  outputGain / N => gain.gain;

  for (int i; i < N; i++) {
    pitches[i] => Std.mtof => tones[i].freq;
    Math.gauss(pitches[i], MU, SIGMA) * SCALE => float intensity;
    intensity * 90 => Math.dbtorms => tones[i].gain;

    Math.fabs(speed) => float step;
    if (step < 0.0001) 0.0001 => step;
    if (direction < 0) -step +=> pitches[i];
    else step +=> pitches[i];

    if (pitches[i] > 120) 108 -=> pitches[i];
    else if (pitches[i] < 12) 108 +=> pitches[i];
  }

  1::ms => now;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  description: 'Continuous Shepard-Risset tone with controllable direction and speed.',
  data: { expr: code.trim() }
};
