import { describe, expect, it } from 'vitest';
import { createGlslCookPolicy } from './glslCookPolicy';

describe('createGlslCookPolicy', () => {
  it('allows static shaders to cook on demand', () => {
    const policy = createGlslCookPolicy(`
      uniform vec3 color;
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = vec4(color, 1.0);
      }
    `);

    expect(policy).toEqual({ mode: 'on-demand' });
  });

  it('detects transport-time dependent shaders', () => {
    const policy = createGlslCookPolicy(`
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = vec4(vec3(sin(iTime)), 1.0);
      }
    `);

    expect(policy).toMatchObject({ mode: 'on-demand', timeDependent: true });
  });

  it('ignores time builtins in comments', () => {
    const policy = createGlslCookPolicy(`
      // iTime should not count here
      /*
        iFrame should not count here either
      */
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = vec4(1.0);
      }
    `);

    expect(policy).toEqual({ mode: 'on-demand' });
  });

  it('treats iFrame and iDate as frame-time dependencies', () => {
    expect(
      createGlslCookPolicy('void mainImage(out vec4 c, in vec2 p) { c = vec4(iFrame); }')
    ).toMatchObject({
      frameDependent: true
    });
    expect(
      createGlslCookPolicy('void mainImage(out vec4 c, in vec2 p) { c = iDate; }')
    ).toMatchObject({
      dateDependent: true
    });
  });
});
