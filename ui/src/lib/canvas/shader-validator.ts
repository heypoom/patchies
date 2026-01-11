/** Error messages grouped by line number */
export type LineErrors = Record<number, string[]>;

export interface ShaderValidationResult {
	valid: boolean;
	error?: string;
	/** Error messages grouped by line number */
	lineErrors?: LineErrors;
}

/**
 * Validate a shader by attempting to compile it with WebGL2.
 * This allows us to capture shader errors before passing to regl.
 */
export function validateShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number,
	preambleLines: number = 0
): ShaderValidationResult {
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

		// Parse error messages grouped by line number
		// Format: ERROR: 0:22: 'color' : undeclared identifier
		const lineErrors: LineErrors = {};
		const errorRegex = /ERROR: \d+:(\d+): (.+)/g;

		let match;
		while ((match = errorRegex.exec(errorLog || '')) !== null) {
			const compiledLineNum = parseInt(match[1], 10);
			const errorMessage = match[2].trim();

			// Map compiled shader line number back to user source line number
			const userSourceLine = compiledLineNum - preambleLines;

			if (userSourceLine > 0) {
				if (!lineErrors[userSourceLine]) {
					lineErrors[userSourceLine] = [];
				}
				lineErrors[userSourceLine].push(errorMessage);
			}
		}

		return {
			valid: false,
			error: errorLog ?? '',
			lineErrors: Object.keys(lineErrors).length > 0 ? lineErrors : undefined
		};
	}

	gl.deleteShader(shader);

	return { valid: true };
}
