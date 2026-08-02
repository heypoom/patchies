import type { HydraPreset } from './types';

const code = `// Perpetual elevator buttons
// By Khoparzi
// http://khoparzi.com

shape(3).add(osc(1,0.5,1), 1)
	.add(o1, () => (Math.sin(time/4) * 0.7 + 0.1))
	//.repeat(5)
  	.scale(()=>Math.sin(time / 16)).rotate(0, -0.1)
	.out(o1)

src(o1)
  .rotate(0,0.1)
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
