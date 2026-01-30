export const EXPR_DSP_PRESETS = {
  'sine-osc.dsp': {
    type: 'expr~',
    data: {
      expr: 'sin(t * 440 * PI * 2)'
    }
  },
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
