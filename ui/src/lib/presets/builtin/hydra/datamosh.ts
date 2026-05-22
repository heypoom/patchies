import type { HydraPreset } from './types';

const code = `// based on https://github.com/emptyflash/hydra-datamosh
setVideoCount(1)

src(datamosh(s0, { speed: 3, fps: 30, scale: 0.5 })).out()`;

export const preset: HydraPreset = {
  type: 'hydra',
  description: 'Datamosh a video inlet with a WebCodecs feedback effect',
  data: {
    code: code.trim(),
    messageInletCount: 0,
    messageOutletCount: 0,
    videoInletCount: 1,
    videoOutletCount: 1,
    title: 'Datamosh'
  }
};
