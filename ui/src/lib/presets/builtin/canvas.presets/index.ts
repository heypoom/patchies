import { bitmapRendererPreset } from './bitmaprenderer';
import { fftPreset } from './fft';
import { fractalTreePreset } from './fractal-tree';
import { plotterPreset } from './plotter';
import { paintPreset } from './paint';
import { xyPadPreset } from './xy-pad';
import { hslPickerPreset } from './hsl-picker';
import { rgbPickerPreset } from './rgb-picker';
import { virtualMidiKeyboardPreset } from './virtual-midi-keyboard';
import { scopeWaveformPreset } from './scope-waveform';
import { scopeXYPreset } from './scope-xy';

export const CANVAS_PRESETS = {
  bitmaprenderer: bitmapRendererPreset,
  'fft.canvas': fftPreset,
  'fractal-tree.canvas': fractalTreePreset,
  'plotter.canvas': plotterPreset,
  'particle.canvas': paintPreset,
  'XY Pad': xyPadPreset,
  'HSL Picker': hslPickerPreset,
  'RGB Picker': rgbPickerPreset,
  'midi.keyboard': virtualMidiKeyboardPreset,
  'scope.canvas': scopeWaveformPreset,
  'scope-xy.canvas': scopeXYPreset
};
