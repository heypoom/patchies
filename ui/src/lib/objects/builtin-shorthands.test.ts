import { describe, expect, it } from 'vitest';
import { BUILTIN_OBJECT_SHORTHANDS } from './builtin-shorthands';

function findShorthand(name: string) {
  return BUILTIN_OBJECT_SHORTHANDS.find((s) => s.names.includes(name))!;
}

describe('slider/knob shorthand parsing', () => {
  it('treats single arg as max (min defaults to 0)', () => {
    const { transform } = findShorthand('knob');
    const result = transform('knob 880', 'knob');

    expect(result.data).toMatchObject({ min: 0, max: 880, defaultValue: 440 });
  });

  it('parses two args as min and max', () => {
    const { transform } = findShorthand('slider');
    const result = transform('slider 20 880', 'slider');

    expect(result.data).toMatchObject({ min: 20, max: 880, defaultValue: 450 });
  });

  it('parses three args as min, max, and default', () => {
    const { transform } = findShorthand('fslider');
    const result = transform('fslider 0 1 0.25', 'fslider');

    expect(result.data).toMatchObject({ min: 0, max: 1, defaultValue: 0.25, isFloat: true });
  });
});
