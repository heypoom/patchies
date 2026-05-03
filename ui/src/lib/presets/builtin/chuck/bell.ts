import type { ChuckPreset } from './types';

const code = `second - (now % second) => now;

Blit s => LPF f => dac;
f.set(500, 50);

4 => s.freq;

int x;

while (250::ms => now) {
  (((x * 3) % 8) + 1) * 200 => f.freq;
  x++;
}`;

export const preset: ChuckPreset = {
  type: 'chuck~',
  data: { expr: code.trim() }
};
