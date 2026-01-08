import { fftPreset } from './fft';
import { fractalTreePreset } from './fractal-tree';
import { plotterPreset } from './plotter';
import { paintPreset } from './paint';
import { xyPadPreset } from './xy-pad';

export const CANVAS_PRESETS = {
	'fft.canvas': fftPreset,
	'fractal-tree.canvas': fractalTreePreset,
	'plotter.canvas': plotterPreset,
	'paint.canvas': paintPreset,
	'xy-pad.canvas': xyPadPreset
};
