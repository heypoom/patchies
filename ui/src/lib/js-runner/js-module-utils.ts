export const isSnippetModule = (code: string): boolean => {
	const withoutComments = code.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

	return /\b(import|export)\b/.test(withoutComments);
};
