const PASSTHRU = `setVideoCount(1)
src(s0).out(o0)`;

const DIFF = `setVideoCount(2)
src(s0).diff(s1).out(o0)`;

const BEANS = `osc(30,0.01,1)
  .mult(osc(20,-0.1,1).modulate(noise(3,1)).rotate(0.7))
  .out(o0)`;

type HydraNodeData = {
	code: string;
	messageInletCount?: number;
	messageOutletCount?: number;
	videoInletCount?: number;
	videoOutletCount?: number;
};

const defaults: HydraNodeData = {
	code: '',
	messageInletCount: 0,
	messageOutletCount: 0,
	videoInletCount: 1,
	videoOutletCount: 1
};

export const HYDRA_PRESETS: Record<string, { type: string; data: HydraNodeData }> = {
	'passthru.hydra': {
		type: 'hydra',
		data: {
			...defaults,
			code: PASSTHRU.trim()
		}
	},
	'null.hydra': {
		type: 'hydra',
		data: {
			...defaults,
			code: PASSTHRU.trim()
		}
	},
	'diff.hydra': {
		type: 'hydra',
		data: {
			...defaults,
			code: DIFF.trim(),
			videoInletCount: 2
		}
	},
	'beans.hydra': {
		type: 'hydra',
		data: {
			...defaults,
			code: BEANS.trim(),
			videoInletCount: 0
		}
	}
};
