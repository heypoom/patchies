/**
 * JSRunner passes context values as function parameters, which snapshots primitive numbers.
 * This fluid-canvas-only number-like object resolves to the latest dimension on coercion.
 * It cannot emulate every primitive-number behavior (such as `typeof` or `Number.isFinite`).
 */
export function createDynamicCanvasDimension(getValue: () => number): number {
  return {
    valueOf: getValue,
    toString: () => String(getValue()),
    [Symbol.toPrimitive]: (hint: string) => (hint === 'string' ? String(getValue()) : getValue()),
    toFixed: (digits?: number) => getValue().toFixed(digits),
    toExponential: (digits?: number) => getValue().toExponential(digits),
    toPrecision: (precision?: number) => getValue().toPrecision(precision),
    toLocaleString: (locales?: string | string[], options?: Intl.NumberFormatOptions) =>
      getValue().toLocaleString(locales, options)
  } as unknown as number;
}
