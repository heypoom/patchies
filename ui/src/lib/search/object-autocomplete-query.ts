export function getObjectAutocompleteQuery(expr: string): string {
  return expr.trim();
}

export function shouldSuppressObjectAutocomplete(
  expr: string,
  objectNames: Iterable<string>
): boolean {
  const trimmedStart = expr.trimStart();
  const firstTokenWithSpace = trimmedStart.match(/^(\S+)\s/);

  if (!firstTokenWithSpace) {
    return false;
  }

  const firstToken = firstTokenWithSpace[1].toLowerCase();
  const objectNameSet = new Set(Array.from(objectNames, (name) => name.toLowerCase()));

  return objectNameSet.has(firstToken);
}
