export const getModuleNameByNode = (nodeId: string) => `node-${nodeId}.js`;

export const isSnippetModule = (code: string): boolean => {
	const withoutComments = code.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

	return /\b(import|export)\b/.test(withoutComments);
};

/**
 * If a code has a comment like // @lib <lib-name>, return the lib name.
 *
 * Example: '// @lib lodash' => 'lodash'
 */
export const getLibName = (code: string): string | null => {
	const match = code.match(/\/\/\s*@lib\s+(\S+)/);

	return match ? match[1] : null;
};
