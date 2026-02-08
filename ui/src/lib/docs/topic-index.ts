import { categoryOrder, topicOrder } from '../../routes/docs/docs-nav';
import { TOPIC_TITLES } from './topic-titles-manifest';

export interface TopicMeta {
  slug: string;
  title: string;
  category: string;
}

// Fallback for slugs not in the manifest
function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get title from manifest or fall back to slug conversion
function getTopicTitle(slug: string): string {
  return TOPIC_TITLES[slug] ?? slugToTitle(slug);
}

// Build category lookup map
const topicCategoryMap: Record<string, string> = {};
for (const [category, topics] of Object.entries(topicOrder)) {
  for (const topic of topics) {
    topicCategoryMap[topic] = category;
  }
}

// All topic slugs in order
export const topicSlugs = Object.values(topicOrder).flat();

// Topic metadata with titles from manifest
export const topicMetas: TopicMeta[] = topicSlugs.map((slug) => ({
  slug,
  title: getTopicTitle(slug),
  category: topicCategoryMap[slug] ?? 'Other'
}));

// Group topics by category (in display order)
export function getTopicsByCategory(): Map<string, TopicMeta[]> {
  const groups = new Map<string, TopicMeta[]>();

  for (const category of categoryOrder) {
    const categoryTopics = topicMetas.filter((t) => t.category === category);
    if (categoryTopics.length > 0) {
      groups.set(category, categoryTopics);
    }
  }

  return groups;
}

export { categoryOrder };
