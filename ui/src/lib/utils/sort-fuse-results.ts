import type { FuseResult } from 'fuse.js';

/**
 * Sort Fuse.js search results with prefix matches prioritized.
 * Items whose name starts with the query appear first, then sorted by Fuse score.
 *
 * @param results - Fuse.js search results
 * @param query - The search query (will be lowercased)
 * @param getName - Function to extract the name from an item for prefix comparison
 * @param secondarySort - Optional secondary sort function for items in the same prefix group
 */
export function sortFuseResultsWithPrefixPriority<T>(
  results: FuseResult<T>[],
  query: string,
  getName: (item: T) => string,
  secondarySort?: (a: FuseResult<T>, b: FuseResult<T>) => number
): FuseResult<T>[] {
  const lowerQuery = query.toLowerCase();

  return results.toSorted((a, b) => {
    const aName = getName(a.item).toLowerCase();
    const bName = getName(b.item).toLowerCase();
    const aStartsWith = aName.startsWith(lowerQuery);
    const bStartsWith = bName.startsWith(lowerQuery);

    // Prefix matches come first
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;

    // Use secondary sort if provided
    if (secondarySort) {
      const secondaryResult = secondarySort(a, b);
      if (secondaryResult !== 0) return secondaryResult;
    }

    // Default: sort by Fuse score (lower is better)
    return (a.score ?? 1) - (b.score ?? 1);
  });
}
