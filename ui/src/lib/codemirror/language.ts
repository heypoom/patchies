import type { Extension } from '@codemirror/state';
import { match } from 'ts-pattern';

const cachedLanguages: Record<string, Extension> = {};

export async function loadLanguageExtension(language: string) {
	if (cachedLanguages[language]) {
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
		.with('python', async () => {
			const { python } = await import('@codemirror/lang-python');

			return python();
		})
		.with('markdown', async () => {
			const { markdown } = await import('@codemirror/lang-markdown');

			return markdown();
		})
		.otherwise(() => []);

	cachedLanguages[language] = extension;

	return extension;
}
