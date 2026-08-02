import type { HydraPreset } from './types';

const code = `setTitle('sub')
setVideoCount(2)
src(s0).sub(s1, 0.5).out(o0)`;

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
