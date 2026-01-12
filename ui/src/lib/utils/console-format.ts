/**
 * Utilities for parsing console format directives like %c for CSS styling
 */

// Allowed CSS properties for %c formatting (security whitelist)
const allowedCssProperties = new Set([
	'color',
	'background',
	'background-color',
	'font-weight',
	'font-style',
	'font-size',
	'text-decoration',
	'border',
	'border-radius',
	'padding',
	'margin'
]);

export type StyledSegment = { text: string; style: string };

/**
 * Sanitize CSS string to only allow safe properties
 */
export function sanitizeCss(css: string): string {
	if (!css || typeof css !== 'string') return '';

	return css
		.split(';')
		.map((rule) => rule.trim())
		.filter((rule) => {
			if (!rule) return false;
			const colonIndex = rule.indexOf(':');
			if (colonIndex === -1) return false;
			const property = rule.substring(0, colonIndex).trim().toLowerCase();
			return allowedCssProperties.has(property);
		})
		.join(';');
}

/**
 * Parse %c formatted string into styled segments
 */
export function parseStyledString(template: string, styleArgs: string[]): StyledSegment[] {
	const segments: StyledSegment[] = [];
	const parts = template.split('%c');

	for (let i = 0; i < parts.length; i++) {
		const text = parts[i];
		if (!text) continue;

		// First part before any %c has no style, rest get styles from args
		const styleIndex = i - 1;
		const rawStyle = styleIndex >= 0 && styleIndex < styleArgs.length ? styleArgs[styleIndex] : '';
		const sanitizedStyle = sanitizeCss(rawStyle);

		segments.push({ text, style: sanitizedStyle });
	}

	return segments;
}

/**
 * Check if console args use %c formatting
 */
export function hasStyleDirective(args: unknown[]): boolean {
	if (args.length < 2) return false;
	const first = args[0];
	return typeof first === 'string' && first.includes('%c');
}

/**
 * Parse console args with %c formatting into styled segments and remaining args
 */
export function parseConsoleArgs(args: unknown[]): {
	styledSegments: StyledSegment[] | null;
	remainingArgs: unknown[];
} {
	if (!hasStyleDirective(args)) {
		return { styledSegments: null, remainingArgs: args };
	}

	const template = args[0] as string;
	const styleArgs = args.slice(1).filter((arg): arg is string => typeof arg === 'string');
	const styledSegments = parseStyledString(template, styleArgs);

	const styleCount = (template.match(/%c/g) || []).length;
	const remainingArgs = args.slice(1 + styleCount);

	return { styledSegments, remainingArgs };
}
