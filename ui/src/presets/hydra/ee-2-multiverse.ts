import type { HydraPreset } from './types';

const code = `// ee_2 . MULTIVERSE . time and feedback
// e_e // @eerie_ear
pat = ()=>
solid()
.layer(solid().diff(
  osc((time/16) * 1, (time/1000) * 0.2  )
    .mult(osc((time/8) * 1, (time/1006) * 0.2  ).rotate(1.57))
    .modulate((shape(106,1,0.05)))
    .mult(shape(106,1,0.05))
  ))
  .modulateScale(osc(2,0.125),0.125)
//
solid()
.layer(solid(1,1,1)
  .mult(pat()
  .diff(src(o0).scale(0.2).mult(solid(),[0.7,0.6,0.4,0.6]).kaleid(1.01).saturate(0.3))
)
.layer(solid(1,1,1)
    .mask(
      noise(2,0.05)
      .invert().colorama(2).posterize(8,4).luma(0.25).thresh(0.5)
      .modulateRotate(osc(1,0.5))
    )
    .mult(gradient(0.5).kaleid(1).colorama(2).saturate(1.1).contrast(1.6).mult(solid(),0.45))
  ))
  .out()
//
speed= 0.5`;

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
