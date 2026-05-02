import type { HydraPreset } from './types';

const code = `//ee_5 . FUGITIVE GEOMETRY VHS . audioreactive shapes and gradients
// e_e // @eerie_ear
//
await settings.define([
  { key: 'sensitivity', label: 'FFT Sensitivity', type: 'slider', min: 0, max: 20, default: 8, step: 0.1 },
  { key: 'feedback', label: 'Feedback Amount', type: 'slider', min: 0, max: 0.99, default: 0.6, step: 0.01 }
]);

const bin = (i) => (fft().a && fft().a[i] !== undefined) ? fft().a[i] : 0;

let s = () =>
  shape(4)
    .scrollX([-0.5, -0.2, 0.3, -0.1, -0.1].smooth(0.1).fast(0.3))
    .scrollY([0.25, -0.2, 0.3, -0.1, 0.2].smooth(0.9).fast(0.15));

solid()
  .add(
    gradient(3, 0.05).rotate(0.05, -0.2).posterize(2).contrast(0.6),
    [1, 0, 1, 0.5, 0, 0.6].smooth(0.9)
  )
  .add(s())
  .mult(
    s().scale(0.8).scrollX(0.01).scrollY(-0.01).rotate(0.2, 0.06)
      .add(gradient(3).contrast(0.6), [1, 0, 1, 0.5].smooth(0.9), 0.5)
      .mult(src(o0).scale(0.98), () => bin(0) * settings.get('sensitivity'))
  )
  .diff(s().modulate(shape(500)).scale([1.7, 1.2].smooth(0.9).fast(0.05)))
  .add(gradient(2).invert(), () => bin(2) * (settings.get('sensitivity') * 0.1))
  .mult(gradient(() => bin(3) * settings.get('sensitivity')))
  .blend(src(o0), () => settings.get('feedback'))
  .add(
    voronoi(() => bin(1) * 5, () => bin(3) * 5, () => bin(0) * 5)
      .thresh(0.7)
      .posterize(2, 4)
      .luma(0.9)
      .scrollY(1, () => bin(0) / 30)
      .colorama(3)
      .thresh(() => bin(1))
      .scale(() => bin(3) * 2),
    () => (bin(0) * settings.get('sensitivity')) / 10
  )
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
