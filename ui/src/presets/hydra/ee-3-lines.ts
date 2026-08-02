import type { HydraPreset } from './types';

const code = `// ee_3 //LINES
// e_e // @eerie_ear
//
//based on
//@naoto_hieda
//https://naotohieda.com/blog/hydra-book/
//
n = 8
a = () => shape(4,0.25,0.009).rotate(()=>time/-40).repeat(n,n)
a().add(a().scrollX(0.5/n).scrollY(0.5/n),1).modulate(o1,0.1).modulate(src(o1).color(10,10).add(solid(-14,-14)).rotate(()=>time/40),0.005).add(src(o1).scrollY(0.012,0.02),0.5).out(o1)
src(o1).colorama(1.2).posterize(4).saturate(0.7).contrast(6).mult(solid(),0.15).out(o0)`;

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
