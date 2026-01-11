/**
 * Validate a shader by attempting to compile it with WebGL2.
 * This allows us to capture shader errors before passing to regl.
 */
export function validateShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number,
	preambleLines: number = 0
): { valid: boolean; error?: string; errorLine?: number } {
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

		// Extract line number from error log
		const lineMatch = (errorLog || '').match(/ERROR: \d+:(\d+):/);
		const compiledLineNum = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

		// Map compiled shader line number back to user source line number
		const userSourceLine = compiledLineNum ? compiledLineNum - preambleLines : undefined;

		return { valid: false, error: errorLog ?? '', errorLine: userSourceLine };
	}

	gl.deleteShader(shader);

	return { valid: true };
}
