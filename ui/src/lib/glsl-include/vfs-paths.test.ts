import { describe, expect, it } from 'vitest';

import { isEditablePatchGlslPath, resolveVfsIncludeCandidates } from './vfs-paths';

describe('GLSL VFS include paths', () => {
  it('resolves relative paths from node code and nested Patch files', () => {
    expect(resolveVfsIncludeCandidates('./shaders/noise')).toEqual([
      'patch://shaders/noise',
      'patch://shaders/noise.glsl'
    ]);

    expect(
      resolveVfsIncludeCandidates('../shared/color.glsl', 'patch://shaders/material/main.glsl')
    ).toEqual(['patch://shaders/shared/color.glsl']);
  });

  it('preserves explicit Patch and User namespaces', () => {
    expect(resolveVfsIncludeCandidates('patch://shared/math')).toEqual([
      'patch://shared/math',
      'patch://shared/math.glsl'
    ]);
    expect(resolveVfsIncludeCandidates('user://shaders/color.frag')).toEqual([
      'user://shaders/color.frag'
    ]);
  });

  it('rejects namespace escapes', () => {
    expect(() => resolveVfsIncludeCandidates('../secret.glsl')).toThrow('cannot escape patch://');
    expect(() =>
      resolveVfsIncludeCandidates('../../../secret.glsl', 'user://shaders/main.glsl')
    ).toThrow('cannot escape user://');
  });

  it('only exposes Patch GLSL files as editable during Stage 2', () => {
    expect(isEditablePatchGlslPath('patch://shaders/noise.glsl')).toBe(true);
    expect(isEditablePatchGlslPath('patch://shader.js')).toBe(false);
    expect(isEditablePatchGlslPath('user://shaders/noise.glsl')).toBe(false);
  });
});
