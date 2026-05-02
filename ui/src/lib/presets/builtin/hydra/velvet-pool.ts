import type { HydraPreset } from './types';

const code = `// Velvet Pool
// by Mahalia H-R
// IG: mm_hr_


noise()
.color(() => fft().a[2]*2,0,.6)
.modulate(noise(() => fft().a[0]*10))
.scale(()=> fft().a[2]*5)
.layer(
  src(o0)
  .mask(osc(10).modulateRotate(osc(),90,0))
  .scale(() => fft().a[0]*2)
  .luma(0.2,0.3)
)
.blend(o0)
.out(o0)

osc()
.modulate(noise(() => fft().a[1]+5))
.color(1,0,0)
.out(o1)

src(o0)
.modulate(o1)
.layer(
  src(o1)
  .mask(o1)
  .saturate(7)
)
.modulateRotate(o1)
.rotate(({time}) => time%360*0.05)
.out(o2)

render(o2)`;

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
