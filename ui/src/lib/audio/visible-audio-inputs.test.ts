import { describe, expect, it } from 'vitest';
import {
  getInitialSimpleDspAudioInputVisibility,
  getRunSimpleDspAudioInputVisibility,
  hasChuckAdcReference,
  hasNoAudioInputDirective
} from './visible-audio-inputs';

describe('visible audio input helpers', () => {
  it('detects ChucK adc references as requiring a visible audio input', () => {
    expect(hasChuckAdcReference('adc => Gain g => dac;')).toBe(true);
    expect(hasChuckAdcReference('adc.left => dac.left;')).toBe(true);
  });

  it('ignores non-adc ChucK code when deciding audio input visibility', () => {
    expect(hasChuckAdcReference('SinOsc s => dac;')).toBe(false);
    expect(hasChuckAdcReference('SinOsc modulator => blackhole;')).toBe(false);
    expect(hasChuckAdcReference('myadc => dac;')).toBe(false);
    expect(hasChuckAdcReference('// adc => dac;')).toBe(false);
  });

  it('detects simple DSP audio input opt-out directives', () => {
    expect(hasNoAudioInputDirective('noAudioInput();')).toBe(true);
  });

  it('ignores opt-out directive names inside JavaScript comments and strings', () => {
    expect(hasNoAudioInputDirective('// noAudioInput();')).toBe(false);
    expect(hasNoAudioInputDirective("const msg = 'noAudioInput()';")).toBe(false);
  });

  it('uses stored simple DSP audio input state during initialization when present', () => {
    expect(getInitialSimpleDspAudioInputVisibility(false, '')).toBe(false);
    expect(getInitialSimpleDspAudioInputVisibility(true, 'noAudioInput()')).toBe(true);
  });

  it('derives simple DSP audio input state from code only for initialization or run', () => {
    expect(getInitialSimpleDspAudioInputVisibility(undefined, 'noAudioInput()')).toBe(false);
    expect(getInitialSimpleDspAudioInputVisibility(undefined, '')).toBe(true);
    expect(getRunSimpleDspAudioInputVisibility('noAudioInput()')).toBe(false);
    expect(getRunSimpleDspAudioInputVisibility('')).toBe(true);
  });
});
