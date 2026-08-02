import { uniq } from 'lodash';

const RESERVED_TAG_PREFIX = 'core/';

export function getUserTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  const normalizedTags = tags.flatMap((rawTag) => {
    if (typeof rawTag !== 'string') return [];

    const tag = rawTag.trim();

    return tag && !tag.startsWith(RESERVED_TAG_PREFIX) ? [tag] : [];
  });

  return uniq(normalizedTags);
}
