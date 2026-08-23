export type CatalogKind = 'objects' | 'presets';

type CatalogSearchResult = {
  categoryCount: number;
  hasNameMatch: boolean;
};

export function getDisplayedCatalogKind(
  catalogKind: CatalogKind,
  objectSearch: CatalogSearchResult,
  presetSearch: CatalogSearchResult
): CatalogKind {
  const selectedSearch = catalogKind === 'objects' ? objectSearch : presetSearch;

  const alternateCatalogKind = catalogKind === 'objects' ? 'presets' : 'objects';
  const alternateSearch = alternateCatalogKind === 'objects' ? objectSearch : presetSearch;

  if (!selectedSearch.hasNameMatch && alternateSearch.hasNameMatch) {
    return alternateCatalogKind;
  }

  if (selectedSearch.categoryCount > 0) return catalogKind;

  return alternateSearch.categoryCount > 0 ? alternateCatalogKind : catalogKind;
}

export function catalogHasNameMatch(
  categories: readonly { objects: readonly { name: string }[] }[],
  query: string
): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  return categories.some((category) =>
    category.objects.some((object) => object.name.toLowerCase().includes(normalizedQuery))
  );
}
