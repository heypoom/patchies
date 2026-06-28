import type { SettingsField, SettingsSchema, SettingsVisibilityCondition } from './types';

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

  return isVisibilityConditionMet(schema, values, field.visibleWhen);
}

function isVisibilityConditionMet(
  schema: SettingsSchema,
  values: Record<string, unknown>,
  condition: SettingsVisibilityCondition
): boolean {
  if ('all' in condition) {
    return condition.all.every((child) => isVisibilityConditionMet(schema, values, child));
  }

  if ('not' in condition) {
    return !isVisibilityConditionMet(schema, values, condition.not);
  }

  return settingsValueEquals(
    getSettingsFieldValue(schema, values, condition.key),
    condition.equals
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
