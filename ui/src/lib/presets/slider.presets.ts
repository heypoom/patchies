export const SLIDER_PRESETS: Record<
  string,
  {
    type: string;
    data: { min?: number; max?: number; defaultValue?: number; isFloat?: boolean; value?: number };
  }
> = {
  'float.slider': { type: 'slider', data: { min: 0, max: 1, defaultValue: 0.5, isFloat: true } },
  'midi.slider': { type: 'slider', data: { min: 0, max: 127, defaultValue: 64, isFloat: false } }
};
