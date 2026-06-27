import { describe, expect, it } from 'vitest';

import type { SettingsSchema } from './types';
import { isSettingsFieldVisible } from './visibility';

describe('settings field visibility', () => {
  const schema: SettingsSchema = [
    {
      key: 'kit',
      label: 'Kit',
      type: 'select',
      options: ['Built In', 'Custom'],
      default: 'Built In'
    },
    {
      key: 'instrumentUrl',
      label: 'Instrument URL',
      type: 'string',
      visibleWhen: { key: 'kit', equals: 'Custom' }
    }
  ];

  it('shows fields without a visibility condition', () => {
    expect(isSettingsFieldVisible(schema, {}, schema[0])).toBe(true);
  });

  it('uses dependency defaults when current values are missing', () => {
    expect(isSettingsFieldVisible(schema, {}, schema[1])).toBe(false);
  });

  it('shows fields when the dependency value matches', () => {
    expect(isSettingsFieldVisible(schema, { kit: 'Custom' }, schema[1])).toBe(true);
  });

  it('hides fields when the dependency value does not match', () => {
    expect(isSettingsFieldVisible(schema, { kit: 'Built In' }, schema[1])).toBe(false);
  });
});
