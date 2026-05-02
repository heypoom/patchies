import type { HydraPreset } from './types';

const code = `// "eye of the beholder"
// Alexandre Rangel
// www.alexandrerangel.art.br/hydra.html

noise(6,.05)
.mult( osc(9,0, ()=>Math.sin(time/1.5)+2 ) )
.mult(
    noise(9,.03).brightness(1.2).contrast(2)
    .mult( osc(9,0, ()=>Math.sin(time/3)+13 ) )
)
.diff(
    noise(15,.04).brightness(.2).contrast(1.3)
    .mult( osc(9,0, ()=>Math.sin(time/5)+13 ) )
    .rotate( ()=>time/33 )
)
.scale( ()=>Math.sin(time/6.2)*.12+.15 )
.modulateScale(
    osc(3,0,0).mult( osc(3,0,0).rotate(3.14/2) )
    .rotate( ()=>time/25 ).scale(.39).scale(1,.6,1).invert()
    , ()=>Math.sin(time/5.3)*1.5+3  )
.rotate( ()=>time/22 )
.mult( shape(100,.9,.01).scale(1,.6,1) )
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
