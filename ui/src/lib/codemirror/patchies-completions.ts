import {
	CompletionContext as CMCompletionContext,
	type Completion
} from '@codemirror/autocomplete';

/**
 * Patchies API function completions for JavaScript-based nodes
 */
const patchiesAPICompletions: Completion[] = [
	// Message API
	{
		label: 'send',
		type: 'function',
		detail: '(message, options?) => void',
		info: 'Send a message to connected nodes. Options: {to: outletIndex}',
		apply: 'send()'
	},
	{
		label: 'recv',
		type: 'function',
		detail: '(callback) => void',
		info: 'Register a callback to receive messages from inlets. Callback receives (data, meta)',
		apply: 'recv((data, meta) => {\n  \n})'
	},
	{
		label: 'onMessage',
		type: 'function',
		detail: '(callback) => void',
		info: 'Alias for recv(). Register a callback to receive messages from inlets',
		apply: 'onMessage((data, meta) => {\n  \n})'
	},

	// Port Configuration
	{
		label: 'setPortCount',
		type: 'function',
		detail: '(inlets: number, outlets: number) => void',
		info: 'Set the number of message inlets and outlets for this node',
		apply: 'setPortCount(0, 1)'
	},
	{
		label: 'setAudioPortCount',
		type: 'function',
		detail: '(inlets: number, outlets: number) => void',
		info: 'Set the number of audio inlets and outlets in dsp~ nodes',
		apply: 'setAudioPortCount(0, 1)'
	},
	{
		label: 'setVideoCount',
		type: 'function',
		detail: '(inlets?: number, outlets?: number) => void',
		info: 'Set the number of video inlets and outlets for Hydra nodes (max 4 each). Defaults to 1 if not specified',
		apply: 'setVideoCount(2, 1)'
	},

	// Node Configuration
	{
		label: 'setTitle',
		type: 'function',
		detail: '(title: string) => void',
		info: 'Set the display title of this node',
		apply: 'setTitle("hello")'
	},
	{
		label: 'setRunOnMount',
		type: 'function',
		detail: '(enabled: boolean) => void',
		info: 'Set whether code should run when the patch loads',
		apply: 'setRunOnMount(true)'
	},
	{
		label: 'setKeepAlive',
		type: 'function',
		detail: '(enabled: boolean) => void',
		info: 'Keep the node running even when not connected (for dsp~ nodes)',
		apply: 'setKeepAlive(true)'
	},
	{
		label: 'setHidePorts',
		type: 'function',
		detail: '(hidden: boolean) => void',
		info: 'Hide the input/output ports on visual nodes',
		apply: 'setHidePorts(true)'
	},

	// Timing Functions
	{
		label: 'delay',
		type: 'function',
		detail: '(ms: number) => Promise<void>',
		info: 'Execute a callback after a delay',
		apply: 'await delay(1000)'
	},
	{
		label: 'setInterval',
		type: 'function',
		detail: '(callback, ms) => number',
		info: 'Execute a callback repeatedly at an interval',
		apply: 'setInterval(() => {\n  \n}, 1000)'
	},
	{
		label: 'requestAnimationFrame',
		type: 'function',
		detail: '(callback) => number',
		info: 'Schedule a callback for the next animation frame (with automatic cleanup)',
		apply: 'requestAnimationFrame(() => {\n  \n})'
	},

	// Canvas/Interaction
	{
		label: 'noDrag',
		type: 'function',
		detail: '() => void',
		info: 'Disable dragging interaction in canvas nodes',
		apply: 'noDrag()'
	},

	// Audio Analysis
	{
		label: 'fft',
		type: 'function',
		detail: '(options?) => FFTAnalysis',
		info: 'Get audio frequency analysis data. Options: {smoothing, bins}',
		apply: 'fft().a'
	},

	// Module Loading
	{
		label: 'esm',
		type: 'function',
		detail: '(moduleName: string) => Promise<Module>',
		info: 'Load ES modules from esm.sh (use with top-level await). Example: await esm("lodash")',
		apply: 'await esm("lodash")'
	},

	// Console
	{
		label: 'console.log',
		type: 'function',
		detail: '(...data) => void',
		info: 'Log messages to the virtual console (not browser console)',
		apply: 'console.log()'
	}
];

// Setup functions that should only appear at top-level (not in function bodies)
const topLevelOnlyFunctions = new Set([
	'setPortCount',
	'setAudioPortCount',
	'setVideoCount',
	'setTitle',
	'setRunOnMount',
	'setKeepAlive',
	'setHidePorts',
	'noDrag',
	'recv',
	'onMessage'
]);

// Node-specific functions - only show in certain node types
const nodeSpecificFunctions: Record<string, string[]> = {
	setKeepAlive: ['dsp~'],
	setAudioPortCount: ['dsp~'],
	setVideoCount: ['hydra'],
	setHidePorts: ['p5', 'hydra', 'canvas', 'swgl'],
	noDrag: ['p5', 'canvas'],
	fft: ['js', 'p5', 'hydra', 'canvas', 'swgl', 'strudel']
};

export interface PatchiesContext {
	nodeType?: string;
}

/**
 * Check if cursor is inside a function body by counting braces
 */
function isInsideFunctionBody(text: string): boolean {
	// Look for function patterns followed by opening brace
	const functionPatterns = [
		/\bfunction\s*\w*\s*\([^)]*\)\s*\{/g,
		/\([^)]*\)\s*=>\s*\{/g, // arrow functions with braces
		/\w+\s*\([^)]*\)\s*\{/g // method definitions
	];

	let braceDepth = 0;
	let inFunctionBody = false;

	// Find all function starts and track brace depth
	for (const pattern of functionPatterns) {
		const matches = [...text.matchAll(pattern)];
		if (matches.length > 0) {
			inFunctionBody = true;
			break;
		}
	}

	if (!inFunctionBody) return false;

	// Count braces to see if we're still inside
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '{') braceDepth++;
		if (text[i] === '}') braceDepth--;
	}

	return braceDepth > 0;
}

/**
 * Custom completion source for Patchies API functions
 */
function createPatchiesCompletionSource(patchiesContext?: PatchiesContext) {
	return (context: CMCompletionContext) => {
		const word = context.matchBefore(/\w*/);
		if (!word) return null;
		if (word.from === word.to && !context.explicit) return null;

		// Get the line we're on to check for comments
		const line = context.state.doc.lineAt(context.pos);
		const lineText = line.text;
		const posInLine = context.pos - line.from;

		// Don't complete inside comments
		const commentStart = lineText.indexOf('//');
		if (commentStart !== -1 && posInLine > commentStart) {
			return null;
		}

		// Don't complete inside block comments
		const textBefore = context.state.doc.sliceString(Math.max(0, word.from - 100), word.from);
		const lastBlockCommentStart = textBefore.lastIndexOf('/*');
		const lastBlockCommentEnd = textBefore.lastIndexOf('*/');
		if (lastBlockCommentStart > lastBlockCommentEnd) {
			return null;
		}

		// Check the text before the word to avoid inappropriate contexts
		const recentTextBefore = context.state.doc.sliceString(Math.max(0, word.from - 20), word.from);

		// Don't complete after keywords where function names are expected
		if (/\b(function|class|const|let|var|interface|type|enum)\s+$/.test(recentTextBefore)) {
			return null;
		}

		// Don't complete in object property definitions (key: value)
		if (/:\s*$/.test(recentTextBefore)) {
			return null;
		}

		// Check if we're inside a function body - look at more context
		const allTextBefore = context.state.doc.sliceString(0, word.from);
		const insideFunction = isInsideFunctionBody(allTextBefore);

		// Filter completions based on context
		let options = patchiesAPICompletions;

		// Filter out top-level only functions when inside a function body
		if (insideFunction) {
			options = options.filter((completion) => !topLevelOnlyFunctions.has(completion.label));
		}

		// Filter based on node type
		if (patchiesContext?.nodeType) {
			options = options.filter((completion) => {
				const allowedNodes = nodeSpecificFunctions[completion.label];

				// If function has node restrictions, check if current node is allowed
				if (allowedNodes) {
					return allowedNodes.includes(patchiesContext.nodeType!);
				}

				// No restrictions, always show
				return true;
			});
		}

		// Filter by prefix match only (not substring) - "quan" shouldn't match "requestAnimationFrame"
		const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();
		if (typedText) {
			options = options.filter((completion) =>
				completion.label.toLowerCase().startsWith(typedText)
			);
		}

		return {
			from: word.from,
			options
		};
	};
}

/**
 * CodeMirror extension that provides Patchies API completions
 * @param context Optional context with node type information
 */
export const patchiesCompletions = (context?: PatchiesContext) =>
	createPatchiesCompletionSource(context);
