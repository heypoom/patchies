import { marked } from 'marked';

export interface ObjectHelpContent {
  markdown: string | null;
  htmlContent: string | null;
  hasHelpPatch: boolean;
}

type FetchFn = typeof fetch;

/**
 * Fetches help content for an object type.
 * Returns markdown content (raw and parsed HTML) and whether a help patch exists.
 *
 * @param objectType - The object type to fetch help for
 * @param customFetch - Optional custom fetch function (for SSR with SvelteKit's fetch)
 */
export async function fetchObjectHelp(
  objectType: string,
  customFetch: FetchFn = fetch
): Promise<ObjectHelpContent> {
  const [markdownRes, helpPatchRes] = await Promise.all([
    customFetch(`/content/objects/${objectType}.md`)
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null),
    customFetch(`/help-patches/${objectType}.json`, { method: 'HEAD' })
      .then((res) => res.ok)
      .catch(() => false)
  ]);

  return {
    markdown: markdownRes,
    htmlContent: markdownRes ? (marked.parse(markdownRes) as string) : null,
    hasHelpPatch: helpPatchRes
  };
}
