import { getDefaultNodeData } from '$lib/nodes/defaultNodeData';

import type { ObjectShorthand } from './v2/interfaces/shorthands';

/**
 * Default built-in shorthands.
 */
export const BUILTIN_OBJECT_SHORTHANDS: ObjectShorthand[] = [
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
		names: ['filter'],
		description: 'Filter messages with JS condition',
		transform: (expr, name) => ({
			nodeType: 'filter',
			data: { expr: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['map'],
		description: 'Transform messages with JS expression',
		transform: (expr, name) => ({
			nodeType: 'map',
			data: { expr: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['tap'],
		description: 'Execute side effects and pass through',
		transform: (expr, name) => ({
			nodeType: 'tap',
			data: { expr: expr.replace(name, '').trim() }
		})
	},
	{
		names: ['scan'],
		description: 'Accumulate values with stateful scanning',
		transform: (expr, name) => ({
			nodeType: 'scan',
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
	},
	{
		names: ['iframe'],
		description: 'Embedded web content',
		transform: (expr, name) => {
			let url = expr.replace(name, '').trim();

			if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
				url = `https://${url}`;
			}
			return {
				nodeType: 'iframe',
				data: { url, width: 400, height: 300 }
			};
		}
	},
	{
		names: ['sse'],
		description: 'Server-Sent Events source',
		transform: (expr, name) => {
			let url = expr.replace(name, '').trim();

			if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
				url = `https://${url}`;
			}

			return { nodeType: 'sse', data: { url } };
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
