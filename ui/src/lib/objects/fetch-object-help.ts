import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { HELP_PATCHES_AVAILABLE } from './help-patches-manifest';
import { ObjectRegistry } from '$lib/registry/ObjectRegistry';

// Register only the languages we need for help docs
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);

// Create and export a marked instance with syntax highlighting
export const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }

      return hljs.highlightAuto(code).value;
    }
  })
);

/**
 * Post-process HTML to add target="_blank" to all links.
 * Use this for embedded contexts like HelpView sidebar where links should open in new tabs.
 */
export const addTargetBlankToLinks = (html: string): string =>
  html.replace(/<a\s+href="/g, '<a target="_blank" rel="noopener noreferrer" href="');

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
  // Resolve alias to canonical type name for documentation lookup
  const canonicalType = ObjectRegistry.getInstance().get(objectType)?.type ?? objectType;

  // Check manifest instead of making HEAD request (avoids 404 errors)
  const hasHelpPatch = HELP_PATCHES_AVAILABLE.has(canonicalType);

  const markdownRes = await customFetch(`/content/objects/${canonicalType}.md`)
    .then((res) => {
      if (!res.ok) return null;

      // Check content-type to avoid displaying HTML 404 pages as markdown
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) return null;

      return res.text();
    })
    .catch(() => null);

  return {
    markdown: markdownRes,
    htmlContent: markdownRes ? (marked.parse(markdownRes) as string) : null,
    hasHelpPatch
  };
}
