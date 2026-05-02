import type { HydraPreset } from './types';

const code = `// Cellular & Blobular
// by Mahalia H-R
// IG: mm_hr_

speed = 0.3

shape(20,0.2,0.3)
.color(0.5,0.8,50)
  .scale(() => Math.sin(time)+1*2)
  .repeat(() => Math.sin(time)*10)
  .modulateRotate(o0)
  .scale(() => Math.sin(time)+1 *1.5)
  .modulate(noise(2,2))
  .rotate(1, .2)
  // .invert(2.4)
.out(o0)`;

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
