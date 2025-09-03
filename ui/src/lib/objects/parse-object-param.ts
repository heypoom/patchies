import {
	objectDefinitions,
	type ObjectInlet,
	type ObjectDataType
} from '$lib/objects/object-definitions';
import { match, P } from 'ts-pattern';
import JSON5 from 'json5';

export const UNMODIFIABLES = [
	'signal',
	'bang',
	'message',
	'marker'
] as const satisfies ObjectDataType[];

export const parseStringParamByType = (inlet: ObjectInlet, strValue: string) =>
	match(inlet.type)
		.with(P.union(...UNMODIFIABLES), () => null)
		.with('int', () =>
			strValue === '' ? (inlet.defaultValue ?? 0) : limitToValidNumber(inlet, parseInt(strValue))
		)
		.with('float', () =>
			strValue === '' ? (inlet.defaultValue ?? 0) : limitToValidNumber(inlet, parseFloat(strValue))
		)
		.with('float[]', () => {
			if (!strValue) return inlet.defaultValue ?? [];

			const parsed = JSON5.parse(strValue);
			if (!Array.isArray(parsed)) return inlet.defaultValue ?? [];

			return parsed.map((v) => parseFloat(v));
		})
		.with('int[]', () => {
			const parsed = JSON5.parse(strValue);
			if (!Array.isArray(parsed)) return inlet.defaultValue ?? [];

			return parsed.map((v) => limitToValidNumber(inlet, parseInt(v)));
		})
		.with('string', () => {
			if (inlet.options) {
				if (inlet.options.includes(strValue)) return strValue;

				// For ease of typing, allow you to enter a couple of letters from the option
				// e.g. tr -> triangle, sq -> square
				const prefixed = inlet.options.find((o) => typeof o === 'string' && o.startsWith(strValue));
				if (prefixed) return prefixed;

				return inlet.defaultValue || '';
			}

			return strValue || inlet.defaultValue || '';
		})
		.otherwise(() => strValue || inlet.defaultValue);

export const isUnmodifiableType = (type?: ObjectDataType) =>
	type && UNMODIFIABLES.includes(type as (typeof UNMODIFIABLES)[number]);

export const stringifyParamByType = (
	inlet: ObjectInlet | undefined,
	value: unknown,
	index: number
) => {
	if (!inlet?.type) return String(value);

	if (inlet.formatter) return inlet.formatter(value);

	return match(inlet.type)
		.with(P.union(...UNMODIFIABLES), () => `$${index}`)
		.with(P.union('int[]', 'float[]'), () => {
			if (!Array.isArray(value) && !(value instanceof Float32Array)) {
				return '[]';
			}

			if (inlet.maxDisplayLength !== undefined && value.length > inlet.maxDisplayLength) {
				return inlet.name;
			}

			return `[${(value as number[]).join(',')}]`;
		})
		.with('float', () => {
			// always use n floating point
			if (inlet.precision !== undefined) {
				return (value as number)?.toFixed(inlet.precision);
			}

			// allow up to n floating point
			if (inlet.maxPrecision !== undefined) {
				return formatFloatingPoint(value as number, inlet.maxPrecision);
			}

			return String(value);
		})
		.otherwise(() => String(value));
};

export const parseObjectParamFromString = (name: string, strValues: string[]) => {
	const definition = objectDefinitions[name];
	if (!definition) return strValues;

	const params: unknown[] = [];
	let inputInletIndex = 0;

	for (const inlet of definition.inlets) {
		if (isUnmodifiableType(inlet.type)) {
			params.push(null);
			continue;
		}

		const value = parseStringParamByType(inlet, strValues[inputInletIndex]);
		params.push(value);

		inputInletIndex += 1;
	}

	return params;
};

const limitToValidNumber = (inlet: ObjectInlet, parsedValue: number) => {
	const defaultValue = inlet.defaultValue ?? 0;

	if (inlet.minNumber !== undefined && parsedValue < inlet.minNumber) {
		return defaultValue;
	}

	if (inlet.maxNumber !== undefined && parsedValue > inlet.maxNumber) {
		return defaultValue;
	}

	if (inlet.options && !inlet.options.includes(parsedValue)) {
		return defaultValue;
	}

	if (typeof parsedValue === 'number' && !isNaN(parsedValue)) {
		return parsedValue;
	}

	return defaultValue;
};

function formatFloatingPoint(num: number, precision = 0): number {
	if (num % 1 === 0) return num;

	const k = Math.pow(10, precision);

	return Math.round(num * k) / k;
}
