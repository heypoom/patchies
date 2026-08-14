import type { JsonValue, SettingsField, SettingsSchema } from './types';

/**
 * Validate and copy a JSON value in one pass.
 *
 * This avoids a JSON stringify/parse round trip for large persisted values
 * while ensuring the value will survive Patchies' JSON patch format unchanged.
 */
export const cloneJsonValue = (value: unknown): JsonValue =>
  cloneJsonValueAt(value, '$', new Set<object>());

export const cloneSettingsFieldValue = (field: SettingsField, value: unknown): unknown =>
  field.type === 'json' ? cloneJsonValue(value) : value;

export const normalizeSettingsSchema = (schema: SettingsSchema): SettingsSchema =>
  schema.map((field) => {
    if (field.type !== 'json' || field.default === undefined) return field;

    return { ...field, default: cloneJsonValue(field.default) };
  });

export function jsonValuesEqual(left: JsonValue, right: JsonValue): boolean {
  if (Object.is(left, right)) return true;

  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && jsonValuesEqual(left[key], right[key]))
  );
}

function cloneJsonValueAt(value: unknown, path: string, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;

  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;

    throw new TypeError(`Invalid JSON value at ${path}: numbers must be finite`);
  }

  if (typeof value !== 'object') {
    throw new TypeError(`Invalid JSON value at ${path}: expected JSON data`);
  }

  if (ancestors.has(value)) {
    throw new TypeError(`Invalid JSON value at ${path}: circular references are not supported`);
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const result: JsonValue[] = [];

      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index);

        if (!descriptor || !('value' in descriptor)) {
          throw new TypeError(
            `Invalid JSON value at ${path}[${index}]: sparse arrays and accessors are not supported`
          );
        }

        result.push(cloneJsonValueAt(descriptor.value, `${path}[${index}]`, ancestors));
      }

      return result;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Invalid JSON value at ${path}: expected a plain object`);
    }

    const result: { [key: string]: JsonValue } = {};

    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (!descriptor || !('value' in descriptor)) {
        throw new TypeError(`Invalid JSON value at ${path}.${key}: accessors are not supported`);
      }

      Object.defineProperty(result, key, {
        value: cloneJsonValueAt(descriptor.value, `${path}.${key}`, ancestors),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }

    return result;
  } finally {
    ancestors.delete(value);
  }
}
