import { describe, expect, it } from 'vitest';
import {
  hasChuckAdcReference,
  hasNoAudioInputDirective,
  shouldShowSimpleDspAudioInput
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

  it('prefers stored simple DSP audio input state over code-derived state', () => {
    expect(shouldShowSimpleDspAudioInput(false, '')).toBe(false);
    expect(shouldShowSimpleDspAudioInput(true, 'noAudioInput()')).toBe(true);
    expect(shouldShowSimpleDspAudioInput(undefined, '')).toBe(true);
  });
});
