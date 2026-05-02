export function canTogglePack({
  locked,
  unavailable
}: {
  locked: boolean;
  unavailable: boolean;
}): boolean {
  return !locked && !unavailable;
}

export function canManuallyExpandPackContents({ searchQuery }: { searchQuery: string }): boolean {
  return searchQuery.trim().length === 0;
}
