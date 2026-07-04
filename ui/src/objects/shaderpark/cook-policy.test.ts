import { describe, expect, it } from 'vitest';
import { createShaderParkCookPolicy } from '$objects/shaderpark/cook-policy';
import { COOK_TEST_UTILS } from '$workers/rendering/cooking/test-utils';

const { ON_DEMAND, TIME_DEPENDENT, MOUSE_DEPENDENT } = COOK_TEST_UTILS;

describe('createShaderParkCookPolicy', () => {
  it('allows static Shader Park code to cook on demand', () => {
    expect(createShaderParkCookPolicy('sphere(0.7);')).toEqual(ON_DEMAND);
  });

  it('treats code that reads time as transport-time dependent', () => {
    expect(createShaderParkCookPolicy('sphere(0.5 + 0.1 * sin(time));')).toEqual(TIME_DEPENDENT);
  });

  it('treats mouse-reactive code as mouse dependent', () => {
    expect(createShaderParkCookPolicy('sphere(length(mouseIntersection()) * 0.1);')).toEqual(
      MOUSE_DEPENDENT
    );

    expect(createShaderParkCookPolicy('color(vec3(mouse.x, mouse.y, 0.0));')).toEqual(
      MOUSE_DEPENDENT
    );
  });

  it('treats 3D Shader Park nodes as mouse dependent for orbit controls', () => {
    expect(createShaderParkCookPolicy('sphere(0.7);', { renderMode: '3d' })).toEqual(
      MOUSE_DEPENDENT
    );
  });

  it('ignores dependencies in comments', () => {
    expect(
      createShaderParkCookPolicy(`
        // time mouse mouseIntersection
        /*
          time should not count here either
        */
        sphere(0.7);
      `)
    ).toEqual(ON_DEMAND);
  });
});
