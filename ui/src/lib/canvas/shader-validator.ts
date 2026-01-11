/**
 * Shader validation and error formatting utilities
 * Provides WebGL2-based shader compilation validation with detailed error reporting
 */

/**
 * Parse WebGL error log and extract line number information
 * Returns formatted string with source code context around the error
 */
export function formatShaderError(
	errorLog: string,
	shaderSource: string,
	shaderType: number
): string {
	const typeName = shaderType === 33985 ? 'fragment' : 'vertex'; // 33985 = FRAGMENT_SHADER

	// Try to extract line number from error message
	// Format is typically: "ERROR: 0:LINE_NUM: message"
	const lineMatch = errorLog.match(/ERROR: \d+:(\d+):/);
	const errorLineNum = lineMatch ? parseInt(lineMatch[1], 10) : null;

	// Build formatted output
	let output = `${typeName.toUpperCase()} SHADER COMPILATION ERROR\n`;
	output += `\n${errorLog}\n`;

	// If we found a line number, show context around it
	if (errorLineNum) {
		const lines = shaderSource.split('\n');
		const contextStart = Math.max(0, errorLineNum - 3); // Show 3 lines before
		const contextEnd = Math.min(lines.length, errorLineNum + 2); // Show 2 lines after

		for (let i = contextStart; i < contextEnd; i++) {
			const lineNum = String(i + 1).padStart(2, ' ');
			const marker = i === errorLineNum - 1 ? '>> ' : '   ';
			output += `${marker}${lineNum}| ${lines[i]}\n`;
		}
	}

	return output;
}

/**
 * Validate a shader by attempting to compile it with WebGL2.
 * This allows us to capture shader errors before passing to regl.
 */
export function validateShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number
): { valid: boolean; error?: string } {
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
		const formattedError = formatShaderError(errorLog || '', shaderSource, shaderType);
		return { valid: false, error: formattedError };
	}

	gl.deleteShader(shader);

	return { valid: true };
}
