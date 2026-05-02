export function isPresetPackAvailableForObjects(
  requiredObjects: string[],
  enabledObjects: Set<string>
): boolean {
  if (requiredObjects.length === 0) return true;

  return requiredObjects.some((objectName) => enabledObjects.has(objectName));
}
