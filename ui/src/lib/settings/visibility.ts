import type { SettingsField, SettingsSchema } from './types';

export function getSettingsFieldValue(
  schema: SettingsSchema,
  values: Record<string, unknown>,
  key: string
): unknown {
  const value = values[key];
  if (value !== undefined) return value;

  const field = schema.find((candidate) => candidate.key === key);
  return field && 'default' in field ? field.default : undefined;
}

export function isSettingsFieldVisible(
  schema: SettingsSchema,
  values: Record<string, unknown>,
  field: SettingsField
): boolean {
  if (!field.visibleWhen) return true;

  return settingsValueEquals(
    getSettingsFieldValue(schema, values, field.visibleWhen.key),
    field.visibleWhen.equals
  );
}

function settingsValueEquals(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => settingsValueEquals(value, right[index]))
    );
  }

  return left === right;
}
