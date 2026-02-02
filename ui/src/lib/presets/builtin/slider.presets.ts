export const SLIDER_PRESETS: Record<
  string,
  {
    type: string;
    data: { min?: number; max?: number; defaultValue?: number; isFloat?: boolean; value?: number };
  }
> = {
  'midi.slider': { type: 'slider', data: { min: 0, max: 127, defaultValue: 64, isFloat: false } }
};
