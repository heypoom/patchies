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

export function deleteAfterComment(s: string, delimiter: string) {
	// Use the String.prototype.indexOf() method to find the starting index of the delimiter.
	const index = s.indexOf(delimiter);

	// If the delimiter is found (index is not -1), return the part of the string
	// from the beginning up to the delimiter's start.
	// The substring method with one argument extracts characters from the start
	// index up to the end of the string.
	// By passing `0` and `index`, we get the substring from the start to the delimiter.
	if (index !== -1) {
		return s.substring(0, index);
	}

	// If the delimiter is not found, return the original string unchanged.
	return s;
}
