import type { InlineValueComponent } from '../types';

function decimalPlaces(text: string) {
  const index = text.indexOf('.');
  return index === -1 ? 0 : text.length - index - 1;
}

export function formatDraggedNumber(text: string, delta: number) {
  const precision = decimalPlaces(text);
  const nextValue = Number(text) + delta;

  if (precision === 0) {
    return String(Math.round(nextValue));
  }

  return nextValue.toFixed(precision);
}

export function dragDeltaForNumber(text: string, pixelDelta: number) {
  const precision = decimalPlaces(text);
  const step = precision === 0 ? 0.05 : 0.01;

  return pixelDelta * step;
}

export function updateDraggedNumberComponent(
  component: InlineValueComponent,
  nextText: string
): InlineValueComponent {
  return {
    from: component.from,
    to: component.from + nextText.length,
    text: nextText,
    value: Number(nextText)
  };
}

export function formatNormalizedVectorComponent(text: string, value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  const precision = text.includes('.') ? decimalPlaces(text) : 3;
  const prefix = text.startsWith('.') ? '.' : '';

  const fixed = clamped.toFixed(precision);
  return prefix ? fixed.replace(/^0\./, '.') : fixed;
}
