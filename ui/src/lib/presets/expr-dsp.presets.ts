export const EXPR_DSP_PRESETS = {
	'bitcrusher.dsp': {
		type: 'expr~',
		data: {
			expr: `(
  Math.floor(((s + 1) / 2) * Math.pow(2, $1))
  / Math.pow(2, $1)
) * 2 - 1`
		}
	}
};
