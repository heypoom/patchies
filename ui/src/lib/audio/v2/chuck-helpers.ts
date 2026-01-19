export const getChuckGlobalVariableType = (code: string, variableName: string): string | null => {
	const match = code.match(new RegExp(`global (int|float) ${variableName};`));
	if (!match) return null;

	return match[1];
};

export const getChuckGlobalVariableArrayType = (
	code: string,
	variableName: string
): string | null => {
	const match = code.match(new RegExp(`global (int|float) ${variableName}\\[\\];`));
	if (!match) return null;

	return match[1];
};
