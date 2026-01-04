import { CompletionContext, type Completion } from '@codemirror/autocomplete';

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

/**
 * Custom completion source for Patchies API functions
 */
function patchiesCompletionSource(context: CompletionContext) {
	const word = context.matchBefore(/\w*/);
	if (!word) return null;
	if (word.from === word.to && !context.explicit) return null;

	// Check the text before the word to avoid inappropriate contexts
	const textBefore = context.state.doc.sliceString(Math.max(0, word.from - 20), word.from);

	// Don't complete after keywords where function names are expected
	if (/\b(function|class|const|let|var|interface|type|enum)\s+$/.test(textBefore)) {
		return null;
	}

	// Don't complete in object property definitions (key: value)
	if (/:\s*$/.test(textBefore)) {
		return null;
	}

	return {
		from: word.from,
		options: patchiesAPICompletions
	};
}

/**
 * CodeMirror extension that provides Patchies API completions
 */
export const patchiesCompletions = patchiesCompletionSource;
