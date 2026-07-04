import { describe, expect, it } from 'vitest';
import { createGlslCookPolicy } from '$objects/glsl/cook-policy';
import { COOK_TEST_UTILS } from '$workers/rendering/cooking/test-utils';

const { ON_DEMAND, TIME_DEPENDENT, FRAME_DEPENDENT, DATE_DEPENDENT } = COOK_TEST_UTILS;

describe('createGlslCookPolicy', () => {
  it('allows static shaders to cook on demand', () => {
    const policy = createGlslCookPolicy(`
      uniform vec3 color;
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = vec4(color, 1.0);
      }
    `);

    expect(policy).toEqual(ON_DEMAND);
  });

  it('detects transport-time dependent shaders', () => {
    const policy = createGlslCookPolicy(`
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        fragColor = vec4(vec3(sin(iTime)), 1.0);
      }
    `);

    expect(policy).toEqual(TIME_DEPENDENT);
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

    expect(policy).toEqual(ON_DEMAND);
  });

  it('treats iFrame and iDate as frame-time dependencies', () => {
    expect(
      createGlslCookPolicy('void mainImage(out vec4 c, in vec2 p) { c = vec4(iFrame); }')
    ).toEqual(FRAME_DEPENDENT);

    expect(createGlslCookPolicy('void mainImage(out vec4 c, in vec2 p) { c = iDate; }')).toEqual(
      DATE_DEPENDENT
    );
  });
});
