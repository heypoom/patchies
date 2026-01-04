import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';
import { nodeNames } from '$lib/nodes/node-types';

/** What node type and initial node data should be */
export interface ShorthandResult {
	nodeType: string;
	data: Record<string, unknown>;
}

/**
 * Object shorthand definition.
 * Shorthands are macros that transform user input into specific node types.
 */
interface ObjectShorthand {
	/** Names that trigger this shorthand (e.g. ['msg', 'm']) */
	names: string[];

	/** Description for autocomplete UI */
	description?: string;

	/** Transform function that returns the node type and data */
	transform: (expr: string, matchedName: string) => ShorthandResult;
}

/**
 * All object shorthands.
 * These are macros that transform into other node types.
 */
const OBJECT_SHORTHANDS: ObjectShorthand[] = [
	{
		names: ['msg', 'm'],
		description: 'Message object',
		transform: (expr, name) => ({
			nodeType: 'msg',
			data: { message: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['label'],
		description: 'Text label',
		transform: (expr, name) => ({
			nodeType: 'label',
			data: { message: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['link'],
		description: 'URL link',
		transform: (expr, name) => {
			const url = expr.replace(name, '').trim() || 'https://example.com';
			return {
				nodeType: 'link',
				data: { url, displayText: url }
			};
		}
	},
	{
		names: ['expr'],
		description: 'Expression evaluator',
		transform: (expr, name) => ({
			nodeType: 'expr',
			data: { expr: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['expr~'],
		description: 'Audio-rate expression',
		transform: (expr, name) => ({
			nodeType: 'expr~',
			data: { expr: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['netsend'],
		description: 'Network message sender',
		transform: (expr, name) => ({
			nodeType: 'netsend',
			data: { channel: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['netrecv'],
		description: 'Network message receiver',
		transform: (expr, name) => ({
			nodeType: 'netrecv',
			data: { channel: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['slider'],
		description: 'Integer slider',
		transform: (expr, name) => {
			const [min, max, defaultValue] = parseSliderExpr(expr, name, 100);
			return {
				nodeType: 'slider',
				data: { min, max, defaultValue, isFloat: false }
			};
		}
	},
	{
		names: ['fslider'],
		description: 'Float slider',
		transform: (expr, name) => {
			const [min, max, defaultValue] = parseSliderExpr(expr, name, 1);
			return {
				nodeType: 'slider',
				data: { min, max, defaultValue, isFloat: true }
			};
		}
	},
	{
		names: ['vslider'],
		description: 'Vertical integer slider',
		transform: (expr, name) => {
			const [min, max, defaultValue] = parseSliderExpr(expr, name, 100);
			return {
				nodeType: 'slider',
				data: { min, max, defaultValue, isFloat: false, vertical: true }
			};
		}
	},
	{
		names: ['vfslider'],
		description: 'Vertical float slider',
		transform: (expr, name) => {
			const [min, max, defaultValue] = parseSliderExpr(expr, name, 1);
			return {
				nodeType: 'slider',
				data: { min, max, defaultValue, isFloat: true, vertical: true }
			};
		}
	},
	{
		names: ['keyboard'],
		description: 'Keyboard input',
		transform: (expr, name) => {
			const keybindPart = expr.replace(name, '').trim();
			const nodeData = getDefaultNodeData(name);

			if (keybindPart.length > 0) {
				nodeData.keybind = keybindPart;
				nodeData.mode = 'filtered';
			}

			return { nodeType: name, data: nodeData };
		}
	}
];

/**
 * Parse slider expression: "slider min max [default]"
 */
function parseSliderExpr(expr: string, name: string, defaultMax: number): [number, number, number] {
	const [min = 0, max = defaultMax, _defaultValue] = expr
		.replace(name, '')
		.trim()
		.split(' ')
		.map(Number);

	let defaultValue = _defaultValue;

	if (defaultValue === undefined) {
		defaultValue = (min + max) / 2;
	}

	return [min, max, defaultValue];
}

/**
 * Get all shorthand names for autocomplete.
 */
export function getShorthandNames(): string[] {
	return OBJECT_SHORTHANDS.flatMap((s) => s.names);
}

/**
 * Try to transform an expression into a visual node.
 * Returns the node type and data if matched, null otherwise.
 *
 * @param expr - The user input expression (e.g. "msg hello world")
 * @returns ShorthandResult or null if no shorthand matches
 */
export function tryTransformShorthand(expr: string): ShorthandResult | null {
	const name = expr.trim().toLowerCase().split(' ')[0];
	if (!name) return null;

	// Check registered shorthands first
	for (const shorthand of OBJECT_SHORTHANDS) {
		if (shorthand.names.includes(name)) {
			return shorthand.transform(expr, name);
		}
	}

	// Fallback: check if it's a known visual node type
	if (nodeNames.includes(name as (typeof nodeNames)[number])) {
		return { nodeType: name, data: getDefaultNodeData(name) };
	}

	return null;
}
