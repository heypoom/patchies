import type { ObjectInlet } from '$lib/objects/v2/object-metadata';

const OSCILLATOR_WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

export const isDraggableOscillatorWaveform = (value: unknown) =>
  typeof value === 'string' && OSCILLATOR_WAVEFORMS.includes(value);

export function getDraggedOscillatorWaveform({
  startValue,
  deltaY
}: {
  startValue: unknown;
  deltaY: number;
}): string | null {
  if (typeof startValue !== 'string' || !Number.isFinite(deltaY)) return null;

  const startIndex = OSCILLATOR_WAVEFORMS.indexOf(startValue);
  if (startIndex === -1) return null;

  const count = OSCILLATOR_WAVEFORMS.length;
  const index = startIndex + Math.trunc(deltaY / 12);
  const waveformIndex = ((index % count) + count) % count;

  return OSCILLATOR_WAVEFORMS[waveformIndex];
}

export const isDraggableParameter = (inlet: ObjectInlet | undefined, value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  (inlet?.type === 'int' ||
    inlet?.type === 'float' ||
    (inlet?.type === 'signal' && inlet.acceptsFloat === true));

export function getDraggedParameterValue({
  inlet,
  startValue,
  deltaY
}: {
  inlet: ObjectInlet;
  startValue: number;
  deltaY: number;
}): number | null {
  const isInteger = inlet.type === 'int';
  const precision = isInteger ? 0 : (inlet.precision ?? inlet.maxPrecision ?? 6);

  const hasSmallDefault =
    typeof inlet.defaultValue === 'number' && Math.abs(inlet.defaultValue) <= 1;

  const hasUnitRange =
    inlet.minNumber !== undefined &&
    inlet.maxNumber !== undefined &&
    inlet.minNumber >= -1 &&
    inlet.maxNumber <= 1;

  const useWholeSteps =
    isInteger || (Number.isInteger(startValue) && !hasSmallDefault && !hasUnitRange);

  const step = useWholeSteps ? 1 : Math.max(0.01, 10 ** -precision);
  const value = startValue + Math.trunc(deltaY) * step;

  const min = inlet.minNumber ?? -Infinity;
  const max = inlet.maxNumber ?? Infinity;

  const bounded = Math.max(min, Math.min(max, value));
  const rounded = Number(bounded.toFixed(precision));

  if (!Number.isFinite(rounded) || rounded < min || rounded > max) return null;
  if (inlet.options && !inlet.options.includes(rounded)) return null;
  if (inlet.validator && !inlet.validator(rounded)) return null;

  return rounded;
}
