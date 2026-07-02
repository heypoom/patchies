export function isTruthyControlValue(value: unknown): boolean {
  // isTruthyControlValue intentionally covers primitive control values only;
  // objects, arrays, null, and undefined are not JavaScript-truthy here.
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;

  return false;
}
