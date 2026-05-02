import type { HydraPreset } from './types';

const code = `//CNDSD
//http://malitzincortes.net/
//ameba

osc(15, 0.01, 0.1).mult(osc(1, -0.1).modulate(osc(2).rotate(4,1), 20))
.color(0,2.4,5)
.saturate(0.4)
.luma(1,0.1, (6, ()=> 1 + fft().a[3]))
.scale(0.7, ()=> 0.7 + fft().a[3])
.diff(o0)// o0
.out(o0)// o1`;

export const preset: HydraPreset = {
  type: 'hydra',
  data: {
    code: code.trim(),
    messageInletCount: 0,
    messageOutletCount: 0,
    videoInletCount: 0,
    videoOutletCount: 1
  }
};
