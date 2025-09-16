import type { Extension } from '@codemirror/state';
import { match } from 'ts-pattern';

const cachedLanguages: Record<string, Extension> = {};

export async function loadLanguageExtension(language: string) {
	// Skip caching for assembly during development to handle HMR properly
	const shouldCache = language !== 'assembly' || !import.meta.hot;

	if (shouldCache && cachedLanguages[language]) {
		return cachedLanguages[language];
	}

	const extension = await match(language)
		.with('javascript', async () => {
			const { javascript } = await import('@codemirror/lang-javascript');

			return javascript();
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
		.with('markdown', async () => {
			const { markdown } = await import('@codemirror/lang-markdown');

			return markdown();
		})
		.otherwise(() => []);

	if (shouldCache) {
		cachedLanguages[language] = extension;
	}

	return extension;
}
