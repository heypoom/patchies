const LOWPASS_ELEM = `setPortCount(1)

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

export const ELEMENTARY_PRESETS = {
	'lowpass.elem': {
		type: 'elem~',
		data: { code: LOWPASS_ELEM, messageInletCount: 1 }
	}
};
