/**
 * Validate a shader by attempting to compile it with WebGL2.
 * This allows us to capture shader errors before passing to regl.
 */
export function validateShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number,
	preambleLines: number = 0
): { valid: boolean; error?: string; errorLines?: number[] } {
	const shader = gl.createShader(shaderType);

	if (!shader) {
		return { valid: false, error: 'Failed to create shader' };
	}

	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
	if (!compiled) {
		const errorLog = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);

		// Extract all line numbers from error log using global regex
		const lineMatches = (errorLog || '').matchAll(/ERROR: \d+:(\d+):/g);
		const errorLinesSet = new Set<number>();

		for (const match of lineMatches) {
			const compiledLineNum = parseInt(match[1], 10);
			// Map compiled shader line number back to user source line number
			const userSourceLine = compiledLineNum - preambleLines;
			if (userSourceLine > 0) {
				errorLinesSet.add(userSourceLine);
			}
		}

		const errorLines =
			errorLinesSet.size > 0 ? Array.from(errorLinesSet).sort((a, b) => a - b) : undefined;

		return { valid: false, error: errorLog ?? '', errorLines };
	}

	gl.deleteShader(shader);

	return { valid: true };
}
