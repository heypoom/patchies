const PASSTHRU = `initSource(s0)
src(s0).out(o0)`;

const DIFF = `initSource(s0, 0)
initSource(s1, 1)
src(s0).diff(s1).out(o0)`;

const BEANS = `osc(30,0.01,1)
  .mult(osc(20,-0.1,1).modulate(noise(3,1)).rotate(0.7))
  .posterize([3,10,2].fast(0.5).smooth(1))
  .out(o0)`;

export const HYDRA_PRESETS: Record<string, { type: string; data: { code: string } }> = {
	'passthru.hydra': { type: 'hydra', data: { code: PASSTHRU.trim() } },
	'diff.hydra': { type: 'hydra', data: { code: DIFF.trim() } },
	'beans.hydra': { type: 'hydra', data: { code: BEANS.trim() } }
};
