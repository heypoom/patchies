import type { ObjectDataType } from '$lib/objects/v2/object-metadata';

/**
 * Name of the type used by fft nodes to indicate where to get the FFT data from.
 */
export const ANALYSIS_KEY = 'analysis' as const satisfies ObjectDataType;
