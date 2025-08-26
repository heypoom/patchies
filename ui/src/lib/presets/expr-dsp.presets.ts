export const EXPR_DSP_PRESETS = {
	'bitcrusher.dsp': {
		type: 'expr~',
		data: {
			expr: `(
  floor(((s + 1) / 2) * (2 ^ $1))
  / (2 ^ $1)
) * 2 - 1`
		}
	}
};
