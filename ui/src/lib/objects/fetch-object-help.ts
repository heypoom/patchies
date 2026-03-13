import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import markedKatex from 'marked-katex-extension';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { HELP_PATCHES_AVAILABLE } from './help-patches-manifest';
import { getCombinedMetadata } from './v2/get-metadata';
import { objectSchemas } from './schemas';
import { objectTypeToSlug } from '$lib/docs/object-slug';

import python from 'highlight.js/lib/languages/python';
import glsl from 'highlight.js/lib/languages/glsl';

// Register languages for help docs and AI chat responses
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('glsl', glsl);

// Create and export a marked instance with syntax highlighting and KaTeX math support
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
  }),
  markedKatex({ throwOnError: false, nonStandard: true })
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
  // Resolve alias to canonical type name for documentation lookup.
  // Use objectSchemas as primary source (works during SSR/prerender when registries are empty),
  // then fall back to runtime registries for types not in the schema registry.
  const canonicalType =
    objectSchemas[objectType]?.type ?? getCombinedMetadata(objectType)?.type ?? objectType;

  // Check manifest instead of making HEAD request (avoids 404 errors)
  const hasHelpPatch = HELP_PATCHES_AVAILABLE.has(canonicalType);

  // Use slug mapping for the fetch path (e.g. /~ → div~, since / can't be in a filename)
  const slug = objectTypeToSlug(canonicalType);

  const markdownRes = await customFetch(`/content/objects/${slug}.md`)
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
