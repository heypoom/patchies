import { describe, expect, it, vi } from 'vitest';

import { processIncludes, type IncludeResolver } from './preprocessor';

function vfsResolver(files: Map<string, string>): IncludeResolver {
  return {
    resolveNpm: vi.fn(async () => ''),
    resolveUrl: vi.fn(async () => ''),
    resolveVfs: vi.fn(async (path) => {
      const source = files.get(path);
      if (source === undefined) throw new Error(`Missing ${path}`);

      return source;
    })
  };
}

describe('processIncludes VFS resolution', () => {
  it('resolves Patch-relative imports recursively and infers only .glsl', async () => {
    const resolver = vfsResolver(
      new Map([
        ['patch://shaders/material.glsl', '#include "../shared/math"\nfloat material = tone;'],
        ['patch://shared/math.glsl', 'float tone = 1.0;']
      ])
    );

    await expect(processIncludes('#include "./shaders/material"', resolver)).resolves.toContain(
      'float tone = 1.0;'
    );

    expect(resolver.resolveVfs).toHaveBeenCalledWith('patch://shaders/material');
    expect(resolver.resolveVfs).toHaveBeenCalledWith('patch://shaders/material.glsl');
    expect(resolver.resolveVfs).toHaveBeenCalledWith('patch://shared/math.glsl');
  });

  it('prefers an exact extensionless Patch file before .glsl', async () => {
    const resolver = vfsResolver(
      new Map([
        ['patch://utility', 'float exact = 1.0;'],
        ['patch://utility.glsl', 'float inferred = 1.0;']
      ])
    );

    await expect(processIncludes('#include "./utility"', resolver)).resolves.toContain('exact');
    expect(resolver.resolveVfs).not.toHaveBeenCalledWith('patch://utility.glsl');
  });

  it('resolves explicit User files without changing their namespace', async () => {
    const resolver = vfsResolver(
      new Map([['user://shared/color.glsl', 'vec3 color = vec3(1.0);']])
    );

    await expect(
      processIncludes('#include "user://shared/color.glsl"', resolver)
    ).resolves.toContain('vec3 color');
    expect(resolver.resolveVfs).toHaveBeenCalledWith('user://shared/color.glsl');
  });

  it('resolves an explicit Patch file from node code', async () => {
    const resolver = vfsResolver(
      new Map([
        [
          'patch://world.glsl',
          'float circle(vec2 point, float radius) { return length(point) - radius; }'
        ]
      ])
    );

    await expect(processIncludes('#include "patch://world.glsl"', resolver)).resolves.toContain(
      'float circle'
    );
    expect(resolver.resolveVfs).toHaveBeenCalledWith('patch://world.glsl');
  });

  it('detects circular Patch imports by canonical path', async () => {
    const resolver = vfsResolver(
      new Map([
        ['patch://a.glsl', '#include "./b.glsl"'],
        ['patch://b.glsl', '#include "./a.glsl"']
      ])
    );

    await expect(processIncludes('#include "./a.glsl"', resolver)).rejects.toThrow(
      'Circular #include detected: vfs:patch://a.glsl'
    );
  });
});
