import { describe, expect, test } from 'vitest';

import { TONE_JS_PRESETS } from './tone.preset';

describe('Tone.js built-in presets', () => {
  test('routes tone> input through a Tone.js gain node before output', () => {
    const preset = TONE_JS_PRESETS['tone>'];
    const code = preset.data.code;

    expect(preset.type).toBe('tone~');
    expect(code).toContain('const gain = new Tone.Gain(1)');
    expect(code).toContain('inputNode.connect(gain.input)');
    expect(code).toContain('gain.connect(outputNode)');
    expect(code).toContain('inputNode.disconnect(gain.input)');
    expect(code).toContain('gain.disconnect(outputNode)');
  });
});
