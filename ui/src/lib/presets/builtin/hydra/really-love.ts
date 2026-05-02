import type { HydraPreset } from './types';

const code = `// Really Love
// by Abhinay Khoparzi
// http://khoparzi.com
osc(100,-0.01245,1).pixelate(50).kaleid(()=>(Math.sin(time/8)*9+3)).rotate(0,0.125)
.modulateRotate(shape(3).scale(()=>(Math.cos(time)*2)).rotate(0,-0.25)).diff(src(o0).brightness(0.3))
  .out()`;

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
