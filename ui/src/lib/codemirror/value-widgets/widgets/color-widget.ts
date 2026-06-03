import { WidgetType } from '@codemirror/view';
import type { InlineValueComponent, InlineValueWidgetInfo } from '../types';

export function colorForComponents(components: InlineValueComponent[]) {
  const [r, g, b] = components.map((component) =>
    Math.max(0, Math.min(255, Math.round(component.value * 255)))
  );

  return `rgb(${r}, ${g}, ${b})`;
}

export function hexColorForComponents(components: InlineValueComponent[]) {
  const channels = components.map((component) =>
    Math.max(0, Math.min(255, Math.round(component.value * 255)))
  );

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function normalizedColorValueFromHex(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;

  const value = match[1];

  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255) as [
    number,
    number,
    number
  ];
}

function decimalPlaces(text: string) {
  const index = text.indexOf('.');
  return index === -1 ? 3 : text.length - index - 1;
}

function formatNormalizedColorComponent(text: string, value: number, precision: number) {
  const clamped = Math.max(0, Math.min(1, value));
  const prefix = text.startsWith('.') ? '.' : '';
  const fixed = clamped.toFixed(precision);

  return prefix ? fixed.replace(/^0\./, '.') : fixed;
}

export function formatNormalizedColorComponents(components: InlineValueComponent[], hex: string) {
  const values = normalizedColorValueFromHex(hex);
  if (!values || components.length !== 3) return null;

  const precision = Math.max(...components.map((component) => decimalPlaces(component.text)));

  return values.map((value, index) =>
    formatNormalizedColorComponent(components[index].text, value, precision)
  ) as [string, string, string];
}

export class ValueCueWidget extends WidgetType {
  constructor(readonly info: InlineValueWidgetInfo) {
    super();
  }

  eq(other: ValueCueWidget) {
    return (
      other.info.kind === this.info.kind &&
      other.info.text === this.info.text &&
      other.info.components.map((component) => component.text).join(',') ===
        this.info.components.map((component) => component.text).join(',')
    );
  }

  toDOM() {
    const cue = document.createElement('span');
    cue.className = `cm-value-widget cm-value-widget-${this.info.kind}`;
    cue.dataset.valueWidgetKind = this.info.kind;
    cue.dataset.valueWidgetFrom = String(this.info.from);
    cue.dataset.valueWidgetTo = String(this.info.to);
    cue.setAttribute('aria-hidden', 'true');

    if (this.info.kind === 'color') {
      cue.style.backgroundColor = colorForComponents(this.info.components);
    }

    return cue;
  }

  ignoreEvent() {
    return false;
  }
}
