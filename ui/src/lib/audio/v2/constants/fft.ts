import type { ObjectDataType } from '$lib/objects/v2/object-metadata';

/**
 * Name of the type used by fft nodes to indicate where to get the FFT data from.
 */
export const ANALYSIS_KEY = 'analysis' as const satisfies ObjectDataType;

/** Uniform name to use for waveform analysis in GLSL */
export const GLSL_FFT_WAVEFORM_UNIFORM_NAME = 'waveTexture';

// FFT polling rates
export const FFT_POLLING_FPS_FOCUSED = 24;
export const FFT_POLLING_FPS_UNFOCUSED = 6;
