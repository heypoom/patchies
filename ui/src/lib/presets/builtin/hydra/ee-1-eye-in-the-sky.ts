import type { HydraPreset } from './types';

const code = `// ee_1 . EYE IN THE SKY
//example of mask and function modulation
// e_e // @eerie_ear
noise(18)
  .colorama(1)
  .posterize(2)
  .kaleid(50)
  .mask(
    shape(25, 0.25).modulateScale(
      noise(400.5, 0.5)
    )
  )
  .mask(shape(400, 1, 2.125))
  .modulateScale(osc(6, 0.125, 0.05).kaleid(50))
  .mult(osc(20, 0.05, 2.4).kaleid(50), 0.25)
  .scale(1.75, 0.65, 0.5)
  .modulate(noise(0.5))
  .saturate(6)
  .posterize(4, 0.2)
  .scale(1.5)
  .out();`;

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
