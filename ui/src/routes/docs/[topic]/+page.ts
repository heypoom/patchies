import { error } from '@sveltejs/kit';
import type { PageLoad, EntryGenerator } from './$types';
import { topicOrder } from '../docs-nav';

// Generate entries for prerendering all topic pages
export const entries: EntryGenerator = () => {
  const topics = Object.values(topicOrder).flat();

  return topics.map((topic) => ({ topic }));
};

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

export const load: PageLoad = async ({ params, fetch }) => {
  const topic = params.topic;

  // Fetch topic markdown
  const res = await fetch(`/content/topics/${topic}.md`);

  if (!res.ok) {
    throw error(404, {
      message: `Documentation not found for "${topic}"`
    });
  }

  const markdown = await res.text();
  const title = extractTitle(markdown, topic);

  return {
    topic,
    title,
    markdown
  };
};
