export function canTogglePack({
  locked,
  unavailable
}: {
  locked: boolean;
  unavailable: boolean;
}): boolean {
  return !locked && !unavailable;
}

export function canManuallyExpandPackContents({
  searchQuery,
  hasMatchingItems,
  variant
}: {
  searchQuery: string;
  hasMatchingItems: boolean;
  variant: 'row' | 'tile';
}): boolean {
  if (searchQuery.trim().length === 0) return true;

  return variant === 'row' && !hasMatchingItems;
}
