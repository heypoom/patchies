import type { HydraPreset } from './types';

const code = `setVideoCount(1)
src(s0).out(o0)`;

export const preset: HydraPreset = {
  type: 'hydra',
  description: 'Pipe video through Hydra',
  data: {
    code: code.trim(),
    messageInletCount: 0,
    messageOutletCount: 0,
    videoInletCount: 1,
    videoOutletCount: 1
  }
};
