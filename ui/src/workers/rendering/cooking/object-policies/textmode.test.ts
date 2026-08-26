import { describe, expect, it } from 'vitest';

import { createTextmodeCookPolicy } from '$workers/rendering/cooking/object-policies/textmode';
import { COOK_TEST_UTILS } from '$workers/rendering/cooking/test-utils';

const { ALWAYS } = COOK_TEST_UTILS;

describe('createTextmodeCookPolicy', () => {
  it('cooks every frame when the draw callback animates module state', () => {
    expect(
      createTextmodeCookPolicy(`
        let rotation = 0;

        t.draw(() => {
          t.rotateZ(rotation);
          rotation += 0.04;
        })
      `)
    ).toEqual(ALWAYS);
  });
});
