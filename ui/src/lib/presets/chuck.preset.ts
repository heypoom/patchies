export const DEMO_CHUCK = `second - (now % second) => now;

Blit s => LPF f => dac;
f.set(500, 50);

4 => s.freq;

int x;

while (250::ms => now) {
  (((x * 3) % 8) + 1) * 200 => f.freq;
  x++;
}`;

export const CHUCK_DEMO_PRESETS = {
	'demo.chuck': {
		type: 'chuck',
		data: { expr: DEMO_CHUCK }
	}
};
