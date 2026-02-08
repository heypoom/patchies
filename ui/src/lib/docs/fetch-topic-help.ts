import { marked } from '$lib/objects/fetch-object-help';

export interface TopicHelpContent {
  markdown: string | null;
  htmlContent: string | null;
  title: string | null;
}

type FetchFn = typeof fetch;

/**
 * Extract title from markdown content (first # heading)
 */
function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Fetches help content for a topic.
 * Returns markdown content (raw and parsed HTML) and extracted title.
 *
 * @param topicSlug - The topic slug to fetch help for
 * @param customFetch - Optional custom fetch function (for SSR with SvelteKit's fetch)
 */
export async function fetchTopicHelp(
  topicSlug: string,
  customFetch: FetchFn = fetch
): Promise<TopicHelpContent> {
  const markdownRes = await customFetch(`/content/topics/${topicSlug}.md`)
    .then((res) => (res.ok ? res.text() : null))
    .catch(() => null);

  return {
    markdown: markdownRes,
    htmlContent: markdownRes ? (marked.parse(markdownRes) as string) : null,
    title: markdownRes ? extractTitle(markdownRes) : null
  };
}
