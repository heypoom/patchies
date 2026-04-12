import { describe, expect, it } from 'vitest';
import {
  shaderCodeToUniformDefs,
  uniformDefsToSettingsSchema,
  parseShaderDirectives,
  parseShaderName
} from './shader-code-to-uniform-def';

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

  it('parses array uniforms with arraySize', () => {
    expect(shaderCodeToUniformDefs('uniform vec2 u_points[32];')).toEqual([
      { name: 'u_points', type: 'vec2', arraySize: 32 }
    ]);
  });

  it('does not set arraySize for non-array uniforms', () => {
    const [def] = shaderCodeToUniformDefs('uniform float u_time;');

    expect(def.arraySize).toBeUndefined();
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
      {
        key: 'u_time',
        label: 'u_time',
        type: 'number',
        default: 0,
        step: 0.01,
        persistence: 'node'
      }
    ]);
  });

  it('generates number field for int', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'u_count', type: 'int' }]);

    expect(fields).toEqual([
      { key: 'u_count', label: 'u_count', type: 'number', default: 0, step: 1, persistence: 'node' }
    ]);
  });

  it('generates boolean field for bool', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'u_enabled', type: 'bool' }]);

    expect(fields).toEqual([
      { key: 'u_enabled', label: 'u_enabled', type: 'boolean', default: false, persistence: 'node' }
    ]);
  });

  it('generates color field for vec3 with color widget', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'tint', type: 'vec3', widget: 'color' }]);

    expect(fields).toEqual([
      { key: 'tint', label: 'tint', type: 'color', default: '#ffffff', persistence: 'node' }
    ]);
  });

  it('returns no field for vec3 without color widget', () => {
    expect(uniformDefsToSettingsSchema([{ name: 'pos', type: 'vec3' }])).toEqual([]);
  });

  it('ignores color widget on non-vec3 types', () => {
    expect(
      uniformDefsToSettingsSchema([{ name: 'x', type: 'float', widget: 'color' }])
    ).toMatchObject([{ type: 'number' }]);
  });

  it('returns no field for unsupported types (vec2, sampler2D, etc.)', () => {
    expect(uniformDefsToSettingsSchema([{ name: 'u_points', type: 'vec2' }])).toEqual([]);
    expect(uniformDefsToSettingsSchema([{ name: 'u_tex', type: 'sampler2D' }])).toEqual([]);
  });

  it('generates slider field when min/max are present with default', () => {
    const fields = uniformDefsToSettingsSchema([
      { name: 'strength', type: 'float', default: 0.5, min: 0.0, max: 1.0 }
    ]);

    expect(fields).toEqual([
      {
        key: 'strength',
        label: 'strength',
        type: 'slider',
        default: 0.5,
        min: 0.0,
        max: 1.0,
        step: 0.01,
        persistence: 'node'
      }
    ]);
  });

  it('uses description as label when present', () => {
    const fields = uniformDefsToSettingsSchema([
      { name: 'strength', type: 'float', min: 0, max: 1, description: 'Aberration strength' }
    ]);

    expect(fields[0].label).toBe('Aberration strength');
  });

  it('generates slider for int with min/max', () => {
    const fields = uniformDefsToSettingsSchema([{ name: 'octaves', type: 'int', min: 1, max: 16 }]);

    expect(fields[0]).toMatchObject({ type: 'slider', min: 1, max: 16, step: 1 });
  });

  it('uses description as label for bool', () => {
    const fields = uniformDefsToSettingsSchema([
      { name: 'invert', type: 'bool', description: 'Invert output' }
    ]);

    expect(fields[0].label).toBe('Invert output');
  });
});

describe('parseShaderName', () => {
  it('parses @title directive', () => {
    expect(parseShaderName('// @title Chromatic Aberration\nuniform float x;')).toBe(
      'Chromatic Aberration'
    );
  });

  it('returns undefined when no @title', () => {
    expect(parseShaderName('uniform float x;')).toBeUndefined();
  });

  it('uses only the first @title', () => {
    expect(parseShaderName('// @title First\n// @title Second')).toBe('First');
  });
});

describe('parseShaderDirectives', () => {
  it('parses @param with all fields', () => {
    const code = '// @param strength 0.01 0.0 0.1 "Aberration strength"';
    const directives = parseShaderDirectives(code);
    const param = directives.params.get('strength');

    expect(param).toEqual({
      name: 'strength',
      default: '0.01',
      min: 0.0,
      max: 0.1,
      description: 'Aberration strength'
    });
  });

  it('parses @param with only name', () => {
    const directives = parseShaderDirectives('// @param gain');

    expect(directives.params.get('gain')).toEqual({ name: 'gain' });
  });

  it('parses @param for bool (coerced at merge time)', () => {
    const code = `
// @param invert true "Invert output"
uniform bool invert;
`;
    const defs = shaderCodeToUniformDefs(code);

    expect(defs[0]).toMatchObject({ name: 'invert', default: true, description: 'Invert output' });
  });

  it('parses multiple directives together', () => {
    const code = `
// @title My Shader
// @param x 0.5 0.0 1.0 "X value"
// @param y 5 1 10 "Y value"
`;
    const directives = parseShaderDirectives(code);

    expect(directives.name).toBe('My Shader');
    expect(directives.params.size).toBe(2);
    expect(directives.params.get('x')?.description).toBe('X value');
    expect(directives.params.get('y')?.min).toBe(1);
  });

  it('parses @param with color widget', () => {
    const directives = parseShaderDirectives('// @param myColor color');
    const param = directives.params.get('myColor');

    expect(param).toEqual({ name: 'myColor', widget: 'color' });
  });

  it('merges color widget into vec3 uniform def', () => {
    const code = `
// @param tint color
uniform vec3 tint;
`;
    const defs = shaderCodeToUniformDefs(code);

    expect(defs[0]).toMatchObject({ name: 'tint', type: 'vec3', widget: 'color' });
  });

  it('merges @param metadata into uniform defs', () => {
    const code = `
// @param strength 0.01 0.0 0.1 "Aberration strength"
uniform float strength; // 0.01
uniform float other; // 1.0
`;
    const defs = shaderCodeToUniformDefs(code);

    expect(defs[0]).toMatchObject({
      name: 'strength',
      default: 0.01,
      min: 0.0,
      max: 0.1,
      description: 'Aberration strength'
    });

    expect(defs[1]).toEqual({ name: 'other', type: 'float' });
  });
});
