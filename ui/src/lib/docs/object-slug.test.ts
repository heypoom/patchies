import { describe, expect, it } from 'vitest';

import { objectSlugToType, objectTypeToSlug } from './object-slug';

describe('object slug helpers', () => {
  it.each([
    ['+', 'add'],
    ['-', 'sub'],
    ['*', 'mul'],
    ['/', 'div'],
    ['/~', 'div~']
  ])('maps %s to URL-safe slug %s and back', (type, slug) => {
    expect(objectTypeToSlug(type)).toBe(slug);
    expect(objectSlugToType(slug)).toBe(type);
  });
});
