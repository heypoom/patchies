import type { HydraPreset } from './types';

const code = `setTitle('blend')
setVideoCount(2)
src(s0).diff(s1).out(o0)`;

export const preset: HydraPreset = {
  type: 'hydra',
  data: {
    code: code.trim(),
    messageInletCount: 0,
    messageOutletCount: 0,
    videoInletCount: 2,
    videoOutletCount: 1
  }
};
