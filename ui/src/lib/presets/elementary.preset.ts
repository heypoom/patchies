const LOWPASS_ELEM = `setPortCount(1)
setTitle('lowpass~')

const [cutoff, setCutoffFreq] = core.createRef("const", {
  value: 500
}, []);

const lpf = el.lowpass(
  cutoff,
  el.const({value: 0.5}),
  el.in({channel: 0})
)

core.render(lpf, lpf)

recv(freq => setCutoffFreq({value: freq}))`;

const createRatePreset = (name: string) => `setPortCount(1)
setTitle('${name}~')

let [rate, setRate] = core.createRef("const", {
  value: 440
}, []);

recv(freq => setRate({ value: freq }))

core.render(el.${name}(rate), el.${name}(rate))`;

export const ELEMENTARY_PRESETS = {
	'lowpass.elem': {
		type: 'elem~',
		data: { code: LOWPASS_ELEM, messageInletCount: 1, title: 'lowpass~' }
	},
	'phasor.elem': {
		type: 'elem~',
		data: { code: createRatePreset('phasor'), messageInletCount: 1, title: 'phasor~' }
	},
	'train.elem': {
		type: 'elem~',
		data: { code: createRatePreset('train'), messageInletCount: 1, title: 'train~' }
	}
};
