import { describe, expect, it } from 'vitest';

import { GlslDependencyIndex } from './dependency-index';

describe('GlslDependencyIndex', () => {
  it('finds direct and transitive consumers once', () => {
    const files = new Map([
      ['patch://shaders/material.glsl', '#include "./math"\nvec3 material() { return tone(); }'],
      ['patch://shaders/math.glsl', 'vec3 tone() { return vec3(1.0); }']
    ]);

    const index = new GlslDependencyIndex();
    index.rebuild(
      [
        { id: 'glsl-1', code: '#include "./shaders/material"\nvoid mainImage() {}' },
        { id: 'glsl-2', code: '#include "patch://shaders/math.glsl"\nvoid mainImage() {}' },
        { id: 'glsl-3', code: 'void mainImage() {}' }
      ],
      (path) => files.get(path)
    );

    expect(index.getConsumers('patch://shaders/material.glsl')).toEqual(new Set(['glsl-1']));
    expect(index.getConsumers('patch://shaders/math.glsl')).toEqual(new Set(['glsl-1', 'glsl-2']));
  });

  it('tracks a missing exact import so creating it refreshes its consumer', () => {
    const index = new GlslDependencyIndex();
    index.rebuild([{ id: 'glsl-1', code: '#include "./missing.glsl"' }], () => undefined);

    expect(index.getConsumers('patch://missing.glsl')).toEqual(new Set(['glsl-1']));
  });
});
