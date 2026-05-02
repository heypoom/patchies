import type { HydraPreset } from './types';

const code = `//CNDSD
//http://malitzincortes.net/
//crazy squares

shape(4, (0.01, ()=> 0.2 + fft().a[2]),1)
.mult(osc(1, 1).modulate(osc(5).rotate(1.4,1),3))
.color(1,2,4)
.saturate(0.2)
.luma(1.2,0.05, (5, ()=> 2 + fft().a[3]))
.scale(0.6, ()=> 0.9 + fft().a[3])
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
