import { describe, expect, it } from 'vitest';
import { shaderCodeToUniformDefs, uniformDefsToSettingsSchema } from './shader-code-to-uniform-def';

describe('shaderCodeToUniformDefs', () => {
  it('parses float uniform', () => {
    expect(shaderCodeToUniformDefs('uniform float u_time;')).toEqual([
      { name: 'u_time', type: 'float' }
    ]);
  });

  it('parses int uniform', () => {
    expect(shaderCodeToUniformDefs('uniform int u_count;')).toEqual([
      { name: 'u_count', type: 'int' }
    ]);
  });

  it('parses bool uniform', () => {
    expect(shaderCodeToUniformDefs('uniform bool u_enabled;')).toEqual([
      { name: 'u_enabled', type: 'bool' }
    ]);
  });

  it('parses multiple uniforms', () => {
    const code = `
      uniform float u_time;
      uniform int u_count;
      uniform bool u_enabled;
    `;
    expect(shaderCodeToUniformDefs(code)).toEqual([
      { name: 'u_time', type: 'float' },
      { name: 'u_count', type: 'int' },
      { name: 'u_enabled', type: 'bool' }
    ]);
  });

  it('parses array uniforms', () => {
    expect(shaderCodeToUniformDefs('uniform vec2 u_points[32];')).toEqual([
      { name: 'u_points', type: 'vec2' }
    ]);
  });

  it('ignores non-uniform lines', () => {
    const code = `
      void main() {
        gl_FragColor = vec4(1.0);
      }
    `;
    expect(shaderCodeToUniformDefs(code)).toEqual([]);
  });
});

describe('uniformDefsToSettingsSchema', () => {
  it('generates number field for float', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'u_time', type: 'float' }]);
    expect(fields).toEqual([
      { key: 'u_time', label: 'u_time', type: 'number', step: 0.01, persistence: 'none' }
    ]);
  });

  it('generates number field for int', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'u_count', type: 'int' }]);
    expect(fields).toEqual([
      { key: 'u_count', label: 'u_count', type: 'number', step: 1, persistence: 'none' }
    ]);
  });

  it('generates boolean field for bool', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'u_enabled', type: 'bool' }]);
    expect(fields).toEqual([
      { key: 'u_enabled', label: 'u_enabled', type: 'boolean', persistence: 'none' }
    ]);
  });

  it('returns no field for unsupported types (vec2, sampler2D, etc.)', () => {
    expect(uniformDefsToSettingsSchema([{ name: 'u_points', type: 'vec2' }])).toEqual([]);
    expect(uniformDefsToSettingsSchema([{ name: 'u_tex', type: 'sampler2D' }])).toEqual([]);
  });
});
