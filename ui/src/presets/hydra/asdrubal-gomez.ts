import type { HydraPreset } from './types';

const code = `//Asdrúbal Gomez

noise(3,0.1,7)
.rotate(1,-1,-2).mask(shape(20))
.colorama(0.5)
.modulateScale(o0)
.modulateScale(o0,1,)
.blend(o0)
.blend(o0)
.blend(o0)
.blend(o0)
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
