import type { Extension } from '@codemirror/state';
import { match } from 'ts-pattern';
import type { PatchiesContext } from '$lib/codemirror/patchies-completions';

const cachedLanguages: Record<string, Extension> = {};

export interface EditorLanguageFeatures {
  autocomplete?: boolean;
  hoverHints?: boolean;
}

const DEFAULT_EDITOR_LANGUAGE_FEATURES = {
  autocomplete: true,
  hoverHints: true
} satisfies Required<EditorLanguageFeatures>;

export async function loadLanguageExtension(
  language: string,
  context?: PatchiesContext,
  features: EditorLanguageFeatures = DEFAULT_EDITOR_LANGUAGE_FEATURES
) {
  const autocompleteEnabled =
    features.autocomplete ?? DEFAULT_EDITOR_LANGUAGE_FEATURES.autocomplete;

  const hoverHintsEnabled = features.hoverHints ?? DEFAULT_EDITOR_LANGUAGE_FEATURES.hoverHints;

  // Skip caching for assembly during development to handle HMR properly
  const shouldCache = language !== 'assembly' || !import.meta.hot;

  // Create cache key that includes node type to avoid context conflicts
  const cacheKey = [
    language,
    context?.nodeType,
    `autocomplete:${autocompleteEnabled}`,
    `hover:${hoverHintsEnabled}`
  ]
    .filter(Boolean)
    .join('-');

  if (shouldCache && cachedLanguages[cacheKey]) {
    return cachedLanguages[cacheKey];
  }

  const extension = await match(language)
    .with('javascript', async () => {
      const [
        { javascript, javascriptLanguage },
        { LanguageSupport },
        { autocompletion },
        { patchiesCompletions },
        { shaderParkCompletionsSource },
        { hydraCompletionsSource },
        { glslInJsCompletions },
        { javascriptMixedWrap },
        { completionHoverHints },
        { glslIncludeHighlighter },
        { inlineValueWidgets }
      ] = await Promise.all([
        import('@codemirror/lang-javascript'),
        import('@codemirror/language'),
        import('@codemirror/autocomplete'),
        import('$lib/codemirror/patchies-completions'),
        import('$lib/codemirror/shaderpark-completions'),
        import('$lib/codemirror/hydra-completions'),
        import('$lib/codemirror/glsl-in-js'),
        import('$lib/codemirror/javascript-mixed'),
        import('$lib/codemirror/hover-hints'),
        import('$lib/codemirror/glsl.codemirror'),
        import('$lib/codemirror/value-widgets')
      ]);

      const jsWithMixedLanguages = javascriptLanguage.configure({ wrap: javascriptMixedWrap });
      const jsSupport = javascript();
      const extensions: Extension[] = [
        new LanguageSupport(jsWithMixedLanguages, jsSupport.support),
        ...glslIncludeHighlighter,
        inlineValueWidgets('javascript', context)
      ];

      if (autocompleteEnabled) {
        extensions.push(
          autocompletion({
            override: [
              glslInJsCompletions,
              shaderParkCompletionsSource(context),
              hydraCompletionsSource(context),
              patchiesCompletions(context)
            ]
          })
        );
      }

      if (hoverHintsEnabled) {
        extensions.push(completionHoverHints({ ...context, language: 'javascript' }));
      }

      return extensions;
    })
    .with('glsl', async () => {
      const [
        { LanguageSupport },
        { autocompletion },
        { glslLanguage, glslIncludeHighlighter, glslDirectiveCompletions },
        { glslCompletions },
        { completionHoverHints },
        { inlineValueWidgets }
      ] = await Promise.all([
        import('@codemirror/language'),
        import('@codemirror/autocomplete'),
        import('$lib/codemirror/glsl.codemirror'),
        import('$lib/codemirror/glsl-completions'),
        import('$lib/codemirror/hover-hints'),
        import('$lib/codemirror/value-widgets')
      ]);

      const extensions: Extension[] = [
        new LanguageSupport(glslLanguage),
        ...glslIncludeHighlighter,
        inlineValueWidgets('glsl', context)
      ];

      if (autocompleteEnabled) {
        extensions.push(autocompletion({ override: [glslDirectiveCompletions, glslCompletions] }));
      }

      if (hoverHintsEnabled) {
        extensions.push(completionHoverHints({ ...context, language: 'glsl' }));
      }

      return extensions;
    })
    .with('assembly', async () => {
      const { assembly } = await import('$lib/codemirror/assembly/assembly');

      return assembly();
    })
    .with('python', async () => {
      const { python } = await import('@codemirror/lang-python');

      return python();
    })
    .with('peppermint', async () => {
      const [
        { autocompletion },
        { peppermint, peppermintCompletions },
        { completionHoverHints },
        { inlineValueWidgets }
      ] = await Promise.all([
        import('@codemirror/autocomplete'),
        import('$lib/codemirror/peppermint.codemirror'),
        import('$lib/codemirror/hover-hints'),
        import('$lib/codemirror/value-widgets')
      ]);

      const extensions: Extension[] = [peppermint(), inlineValueWidgets('peppermint', context)];

      if (autocompleteEnabled) {
        extensions.push(autocompletion({ override: [peppermintCompletions] }));
      }

      if (hoverHintsEnabled) {
        extensions.push(completionHoverHints({ ...context, language: 'peppermint' }));
      }

      return extensions;
    })
    .with('ruby', async () => {
      const [{ StreamLanguage }, { ruby }] = await Promise.all([
        import('@codemirror/language'),
        import('@codemirror/legacy-modes/mode/ruby')
      ]);

      return StreamLanguage.define(ruby);
    })
    .with('wgsl', async () => {
      const { wgsl } = await import('@iizukak/codemirror-lang-wgsl');

      return wgsl();
    })
    .with('markdown', async () => {
      const { markdown } = await import('@codemirror/lang-markdown');

      return markdown();
    })
    .with('uiua', async () => {
      const { uiua } = await import('$lib/codemirror/uiua.codemirror');

      return uiua();
    })
    .otherwise(() => []);

  if (shouldCache) {
    cachedLanguages[cacheKey] = extension;
  }

  return extension;
}
