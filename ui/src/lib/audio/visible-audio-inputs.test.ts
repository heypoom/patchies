import { describe, expect, it } from 'vitest';
import {
  getInitialSimpleDspAudioInputVisibility,
  hasAudioInputUsage,
  hasChuckAdcReference,
  hasShowAudioInputDirective
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

  it('detects explicit simple DSP audio input opt-in directives', () => {
    expect(hasShowAudioInputDirective('showAudioInput();')).toBe(true);
  });

  it('ignores opt-in directive names inside JavaScript comments and strings', () => {
    expect(hasShowAudioInputDirective('// showAudioInput();')).toBe(false);
    expect(hasShowAudioInputDirective("const msg = 'showAudioInput()';")).toBe(false);
  });

  it('keeps stored visible audio input state during initialization when present', () => {
    expect(getInitialSimpleDspAudioInputVisibility('tone~', false, '')).toBe(false);
    expect(getInitialSimpleDspAudioInputVisibility('tone~', true, '')).toBe(true);
  });

  it('auto-shows tone~ audio input when code references inputNode', () => {
    expect(hasAudioInputUsage('tone~', 'inputNode.connect(filter.input.input)')).toBe(true);

    expect(hasAudioInputUsage('tone~', 'const synth = new Tone.Synth().connect(outputNode)')).toBe(
      false
    );
  });

  it('auto-shows elem~ audio input when code references inputNode or el.in()', () => {
    expect(hasAudioInputUsage('elem~', 'core.render(el.in({channel: 0}), outputNode)')).toBe(true);

    expect(hasAudioInputUsage('elem~', 'inputNode.connect(node)')).toBe(true);

    expect(hasAudioInputUsage('elem~', 'core.render(el.sine(440), outputNode)')).toBe(false);
  });

  it('auto-shows sonic~ audio input when code references inputNode', () => {
    expect(hasAudioInputUsage('sonic~', 'inputNode.connect(sonicNode.input)')).toBe(true);

    expect(hasAudioInputUsage('sonic~', "sonic.send('/s_new', 'default')")).toBe(false);
  });

  it('showAudioInput() manually shows audio input when heuristics miss usage', () => {
    expect(hasAudioInputUsage('tone~', 'showAudioInput(); helperUsesInput();')).toBe(true);

    expect(
      getInitialSimpleDspAudioInputVisibility(
        'sonic~',
        false,
        'showAudioInput(); helperUsesInput();'
      )
    ).toBe(true);
  });
});
