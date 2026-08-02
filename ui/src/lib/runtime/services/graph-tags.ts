const RESERVED_TAG_PREFIX = 'core/';

export function getUserTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  return Array.from(
    new Set(
      tags.flatMap((tag) => {
        if (typeof tag !== 'string') return [];

        const normalizedTag = tag.trim();

        return normalizedTag && !normalizedTag.startsWith(RESERVED_TAG_PREFIX)
          ? [normalizedTag]
          : [];
      })
    )
  );
}
