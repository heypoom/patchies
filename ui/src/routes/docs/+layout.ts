import type { LayoutLoad } from './$types';
import { objectSchemas } from '$lib/objects/schemas';
import { topicOrder } from './docs-nav';

export const prerender = true;

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

  // Get all object slugs from the schema registry
  const objectSlugs = Object.keys(objectSchemas);

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

  // Fetch objects
  const objectPromises = objectSlugs.map(async (slug) => {
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
  index.objects = objects.filter((o) => o !== null);

  return { index };
};
