import { fftPreset } from './fft';
import { fractalTreePreset } from './fractal-tree';
import { plotterPreset } from './plotter';
import { paintPreset } from './paint';
import { xyPadPreset } from './xy-pad';
import { hslaPickerPreset } from './hsla-picker';
import { rgbaPickerPreset } from './rgba-picker';
import { keyboardExamplePreset } from './keyboard-example';

export const CANVAS_PRESETS = {
	'fft.canvas': fftPreset,
	'fractal-tree.canvas': fractalTreePreset,
	'plotter.canvas': plotterPreset,
	'particle.canvas': paintPreset,
	'xy-pad.canvas': xyPadPreset,
	'hsla.picker': hslaPickerPreset,
	'rgba.picker': rgbaPickerPreset,
	'keyboard.example': keyboardExamplePreset
};
