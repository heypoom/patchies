import type { LayoutLoad } from './$types';

interface DocItem {
  slug: string;
  title: string;
  category?: string;
}

interface DocsIndex {
  topics: DocItem[];
  objects: DocItem[];
}

// Topic categories for organization
const TOPIC_CATEGORIES: Record<string, string[]> = {
  'Getting Started': ['getting-started', 'creating-objects', 'keyboard-shortcuts'],
  Connections: ['connecting-objects', 'connection-rules', 'message-passing'],
  'Audio & Video': ['audio-chaining', 'video-chaining'],
  Scripting: ['javascript-runner', 'canvas-interaction'],
  'AI Features': ['ai-features'],
  'Managing Projects': ['manage-saves', 'manage-presets', 'manage-files', 'manage-packs'],
  'Sharing & Misc': ['sharing-links', 'offline-usage', 'supporting-open-source']
};

// Invert the mapping for lookup
function buildTopicCategoryMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [category, topics] of Object.entries(TOPIC_CATEGORIES)) {
    for (const topic of topics) {
      map[topic] = category;
    }
  }
  return map;
}

const topicCategoryMap = buildTopicCategoryMap();

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

  // Known topic slugs (we'll fetch each to get the title)
  const topicSlugs = [
    'getting-started',
    'creating-objects',
    'keyboard-shortcuts',
    'connecting-objects',
    'connection-rules',
    'message-passing',
    'audio-chaining',
    'video-chaining',
    'javascript-runner',
    'canvas-interaction',
    'ai-features',
    'manage-saves',
    'manage-presets',
    'manage-files',
    'manage-packs',
    'sharing-links',
    'offline-usage',
    'supporting-open-source'
  ];

  // Known object slugs
  const objectSlugs = ['p5', 'trigger'];

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
