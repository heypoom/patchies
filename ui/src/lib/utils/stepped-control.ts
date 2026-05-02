type ControlStepOptions = {
  min?: number;
  max?: number;
  step?: number;
  isFloat?: boolean;
};

export function getControlStep({ step, isFloat }: ControlStepOptions): number {
  if (typeof step === 'number' && Number.isFinite(step) && step > 0) {
    return step;
  }

  return isFloat ? 0.01 : 1;
}

export function getControlDecimals(step: number): number {
  const normalized = step.toString().toLowerCase();
  const [base, exponent = '0'] = normalized.split('e-');
  const decimalPlaces = base.includes('.') ? (base.split('.')[1]?.length ?? 0) : 0;

  return decimalPlaces + Number(exponent);
}

export function snapControlValue(value: number, options: ControlStepOptions): number {
  const min = options.min ?? 0;
  const max = options.max ?? (options.isFloat ? 1 : 100);
  const step = getControlStep(options);
  const snapped = min + Math.round((value - min) / step) * step;
  const clamped = Math.min(Math.max(snapped, min), max);
  const decimals = getControlDecimals(step);

  return Number(clamped.toFixed(decimals));
}
