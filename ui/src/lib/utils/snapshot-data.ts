/** Snapshot reactive containers while preserving structured-cloneable native values. */
export const snapshotData = <T>(value: T): T => structuredClone(materializeData(value)) as T;

function materializeData(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);

    for (const [key, item] of value) {
      const mk = materializeData(key, seen);
      const mi = materializeData(item, seen);
      copy.set(mk, mi);
    }

    return copy;
  }

  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);

    for (const item of value) {
      copy.add(materializeData(item, seen));
    }

    return copy;
  }

  const prototype = Object.getPrototypeOf(value);
  const isPlainObject = prototype === Object.prototype || prototype === null;

  if (!Array.isArray(value) && !isPlainObject) {
    return value;
  }

  const copy = Array.isArray(value)
    ? Array.from({ length: value.length })
    : Object.create(prototype);

  seen.set(value, copy);

  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(copy, key, {
      value: materializeData(item, seen),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }

  return copy;
}
