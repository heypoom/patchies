import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_OBJECT_SHORTHANDS } from './builtin-shorthands';
import { ObjectShorthandRegistry } from '$lib/registry/ObjectShorthandRegistry';

vi.mock('$lib/nodes/node-types', () => ({ nodeNames: [] }));

function findShorthand(name: string) {
  return BUILTIN_OBJECT_SHORTHANDS.find((s) => s.names.includes(name))!;
}

describe('slider/knob shorthand parsing', () => {
  it('marks sv as the send.vdo shorthand for display', () => {
    const { transform } = findShorthand('sv');
    const result = transform('sv main', 'sv');

    expect(result.nodeType).toBe('send.vdo');
    expect(result.data).toMatchObject({ channel: 'main', shorthand: true });
  });

  it('does not mark full send.vdo usage as shorthand', () => {
    const { transform } = findShorthand('send.vdo');
    const result = transform('send.vdo main', 'send.vdo');

    expect(result.data).toMatchObject({ channel: 'main', shorthand: false });
  });

  it('marks rv as the recv.vdo shorthand for display', () => {
    const { transform } = findShorthand('rv');
    const result = transform('rv main', 'rv');

    expect(result.nodeType).toBe('recv.vdo');
    expect(result.data).toMatchObject({ channel: 'main', shorthand: true });
  });

  it('does not mark full recv.vdo usage as shorthand', () => {
    const { transform } = findShorthand('recv.vdo');
    const result = transform('recv.vdo main', 'recv.vdo');

    expect(result.data).toMatchObject({ channel: 'main', shorthand: false });
  });

  it('injects a typed keybind into keyboard shorthand data', () => {
    const { transform } = findShorthand('keyboard');
    const result = transform('keyboard a', 'keyboard');

    expect(result.nodeType).toBe('keyboard');
    expect(result.data).toMatchObject({ keybind: 'a', mode: 'filtered' });
  });

  it('transforms gm~ into the dedicated visual node', () => {
    const result = ObjectShorthandRegistry.getInstance().tryTransform('gm~');

    expect(result?.nodeType).toBe('gm~');
    expect(result?.data).toMatchObject({
      settings: expect.objectContaining({
        source: 'soundfont',
        kit: 'MusyngKite'
      })
    });
  });

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

  it('parses fourth arg as step', () => {
    const { transform } = findShorthand('fknob');
    const result = transform('fknob 0 1 0.25 0.001', 'fknob');

    expect(result.data).toMatchObject({
      min: 0,
      max: 1,
      defaultValue: 0.25,
      step: 0.001,
      isFloat: true
    });
  });
});
