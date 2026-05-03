import { describe, expect, it } from 'vitest';
import { GLSL_PRESETS } from './index';

describe('GLSL built-in presets', () => {
  it('registers Mask as an alpha clipping preset', () => {
    const maskPreset = GLSL_PRESETS.Mask;
    const code = maskPreset?.data.code;

    expect(maskPreset?.type).toBe('glsl');
    expect(maskPreset?.description).toContain('clip');
    expect(code).toContain('// @title Mask');
    expect(code).toContain('uniform sampler2D source;');
    expect(code).toContain('uniform sampler2D mask;');
    expect(code).toContain('texture(mask, uv).a');
    expect(code).toContain('color.a *= clipAlpha * opacity;');
  });
});
