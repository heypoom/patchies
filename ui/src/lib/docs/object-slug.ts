/** Map of object types that need URL-safe slugs (e.g. `/~` can't be a route param). */
const TYPE_TO_SLUG: Record<string, string> = {
  '/~': 'div~'
};

const SLUG_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_SLUG).map(([type, slug]) => [slug, type])
);

/** Convert an object type name to a URL-safe slug. */
export function objectTypeToSlug(type: string): string {
  return TYPE_TO_SLUG[type] ?? type;
}

/** Convert a URL slug back to the original object type name. */
export function objectSlugToType(slug: string): string {
  return SLUG_TO_TYPE[slug] ?? slug;
}
