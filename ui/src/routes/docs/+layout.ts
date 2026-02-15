import type { LayoutLoad } from './$types';
import { objectSchemas } from '$lib/objects/schemas';
import { topicOrder } from './docs-nav';
import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';
import { objectTypeToSlug, objectSlugToType } from '$lib/docs/object-slug';

export const prerender = true;
export const ssr = true;

interface DocItem {
  slug: string;
  title: string;
  category?: string;
}

interface DocsIndex {
  topics: DocItem[];
  objects: DocItem[];
}

// Invert the mapping for lookup (topic slug -> category)
function buildTopicCategoryMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const [category, topics] of Object.entries(topicOrder)) {
    for (const topic of topics) {
      map[topic] = category;
    }
  }

  return map;
}

const topicCategoryMap = buildTopicCategoryMap();

// Derive topic slugs from topicOrder
const topicSlugs = Object.values(topicOrder).flat();

// Build object order map from packs (pack order -> object order within pack)
function buildObjectOrderMap(): Map<string, number> {
  const map = new Map<string, number>();

  let index = 0;

  for (const pack of BUILT_IN_PACKS) {
    for (const obj of pack.objects) {
      map.set(obj, index++);
    }
  }

  return map;
}

const objectOrderMap = buildObjectOrderMap();

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(markdown: string, fallbackSlug: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);

  if (match) {
    return match[1].trim();
  }

  // Fallback: convert slug to title
  return fallbackSlug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const load: LayoutLoad = async ({ fetch }) => {
  const index: DocsIndex = {
    topics: [],
    objects: []
  };

  // Get all object slugs from the schema registry, filtering out aliases
  // (aliases resolve to their canonical type's documentation)
  const registry = ObjectRegistry.getInstance();

  const objectSlugs = Object.keys(objectSchemas).filter((slug) => {
    const canonicalType = registry.get(slug)?.type;

    // Keep if not in registry (visual nodes) or if slug is the canonical type
    return !canonicalType || canonicalType === slug;
  });

  // Fetch topics
  const topicPromises = topicSlugs.map(async (slug) => {
    try {
      const res = await fetch(`/content/topics/${slug}.md`);

      if (res.ok) {
        const markdown = await res.text();

        return {
          slug,
          title: extractTitle(markdown, slug),
          category: topicCategoryMap[slug]
        };
      }
    } catch {
      // Skip if not found
    }

    return null;
  });

  // Fetch objects (convert type names to URL-safe slugs for markdown paths and links)
  const objectPromises = objectSlugs.map(async (type) => {
    const slug = objectTypeToSlug(type);

    try {
      const res = await fetch(`/content/objects/${slug}.md`);

      if (res.ok) {
        const markdown = await res.text();

        return {
          slug,
          title: extractTitle(markdown, slug)
        };
      }
    } catch {
      // Skip if not found
    }

    return null;
  });

  const [topics, objects] = await Promise.all([
    Promise.all(topicPromises),
    Promise.all(objectPromises)
  ]);

  index.topics = topics.filter((t) => t !== null);

  // Sort objects by pack order (objects not in packs go to the end)
  index.objects = objects
    .filter((o) => o !== null)
    .sort((a, b) => {
      const aOrder = objectOrderMap.get(objectSlugToType(a.slug)) ?? Infinity;
      const bOrder = objectOrderMap.get(objectSlugToType(b.slug)) ?? Infinity;

      return aOrder - bOrder;
    });

  return { index };
};
