export const EXPR_DSP_PRESETS = {
  'sine-osc.dsp': {
    type: 'expr~',
    data: {
      expr: 'sin(t * 440 * PI * 2)'
    }
  },
  'variable-osc.dsp': {
    type: 'expr~',
    data: {
      expr: 'sin(phasor($1) * PI * 2)'
    }
  },
  'phasor.dsp': {
    type: 'expr~',
    data: {
      expr: 'phasor($1) * 2 - 1'
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
