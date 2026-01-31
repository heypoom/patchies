import type { Extension } from '@codemirror/state';
import { match } from 'ts-pattern';
import type { PatchiesContext } from '$lib/codemirror/patchies-completions';

const cachedLanguages: Record<string, Extension> = {};

export async function loadLanguageExtension(language: string, context?: PatchiesContext) {
  // Skip caching for assembly during development to handle HMR properly
  const shouldCache = language !== 'assembly' || !import.meta.hot;

  // Create cache key that includes node type to avoid context conflicts
  const cacheKey = context?.nodeType ? `${language}-${context.nodeType}` : language;

  if (shouldCache && cachedLanguages[cacheKey]) {
    return cachedLanguages[cacheKey];
  }

  const extension = await match(language)
    .with('javascript', async () => {
      const [{ javascript }, { autocompletion }, { patchiesCompletions }] = await Promise.all([
        import('@codemirror/lang-javascript'),
        import('@codemirror/autocomplete'),
        import('$lib/codemirror/patchies-completions')
      ]);

      return [javascript(), autocompletion({ override: [patchiesCompletions(context)] })];
    })
    .with('glsl', async () => {
      const [{ LanguageSupport }, { glslLanguage }] = await Promise.all([
        import('@codemirror/language'),
        import('$lib/codemirror/glsl.codemirror')
      ]);

      return new LanguageSupport(glslLanguage);
    })
    .with('assembly', async () => {
      const { assembly } = await import('$lib/codemirror/assembly/assembly');

      return assembly();
    })
    .with('python', async () => {
      const { python } = await import('@codemirror/lang-python');

      return python();
    })
    .with('ruby', async () => {
      const [{ StreamLanguage }, { ruby }] = await Promise.all([
        import('@codemirror/language'),
        import('@codemirror/legacy-modes/mode/ruby')
      ]);

      return StreamLanguage.define(ruby);
    })
    .with('markdown', async () => {
      const { markdown } = await import('@codemirror/lang-markdown');

      return markdown();
    })
    .otherwise(() => []);

  if (shouldCache) {
    cachedLanguages[cacheKey] = extension;
  }

  return extension;
}
