import type { HydraPreset } from './types';

const code = `//filet mignon
// AFALFL
// instagram/a_f_alfl 

osc(100,-0.0018,0.17).diff(osc(20,0.00008).rotate(Math.PI/0.00003))
.modulateScale(noise(1.5,0.18).modulateScale(osc(13).rotate(()=>Math.sin(time/22))),3)
.color(11,0.5,0.4, 0.9, 0.2, 0.011, 5, 22,  0.5, -1).contrast(1.4)
.add(src(o0).modulate(o0,.04),.6, .9)
  //.pixelate(0.4, 0.2, 0.1)
.invert().brightness(0.0003, 2).contrast( 0.5, 2, 0.1, 2).color(4, -2, 0.1)
.modulateScale(osc(2),-0.2, 2, 1, 0.3)
 .posterize(200) .rotate(1, 0.2, 0.01, 0.001)
 .color(22, -2, 0.5, 0.5, 0.0001,  0.1, 0.2, 8).contrast(0.18, 0.3, 0.1, 0.2, 0.03, 1) . brightness(0.0001, -1, 10)
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
