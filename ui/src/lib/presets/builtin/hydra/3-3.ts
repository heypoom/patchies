import type { HydraPreset } from './types';

const code = `// 3.3
// by ΔNDR0M3DΔ
// https://www.instagram.com/androm3_da/

osc().modulateRotate(o0,0.3).out()
osc(33,0.3,0.3).diff(o3,3).out(o1)
osc(3,0.3,33).modulateKaleid(o3,3).diff(o0).out(o2)
src(o0,3).mult(o1,3).kaleid(3).out(o3)
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
