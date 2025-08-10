import {
	objectDefinitions,
	type ObjectInlet,
	type ObjectDataType
} from '$lib/objects/object-definitions';
import { match, P } from 'ts-pattern';
import JSON5 from 'json5';

export const UNMODIFIABLES = ['signal', 'bang', 'message'] as const satisfies ObjectDataType[];

export const parseStringParamByType = (inlet: ObjectInlet, strValue: string) =>
	match(inlet.type)
		.with(P.union(...UNMODIFIABLES), () => null)
		.with('int', () => limitToValidNumber(inlet, parseInt(strValue)))
		.with('float', () => limitToValidNumber(inlet, parseFloat(strValue)))
		.with('float[]', () => {
			const parsed = JSON5.parse(strValue);
			if (!Array.isArray(parsed)) return inlet.defaultValue ?? [];

			return parsed.map((v) => limitToValidNumber(inlet, parseFloat(v)));
		})
		.with('int[]', () => {
			const parsed = JSON5.parse(strValue);
			if (!Array.isArray(parsed)) return inlet.defaultValue ?? [];

			return parsed.map((v) => limitToValidNumber(inlet, parseInt(v)));
		})
		.with('string', () => {
			if (inlet.options && !inlet.options.includes(strValue)) return inlet.defaultValue || '';

			return strValue || inlet.defaultValue || '';
		})
		.otherwise(() => strValue || inlet.defaultValue);

export const isUnmodifiableType = (type?: ObjectDataType) =>
	type && UNMODIFIABLES.includes(type as any);

export const stringifyParamByType = (
	inlet: ObjectInlet | undefined,
	value: unknown,
	index: number
) => {
	if (!inlet?.type) return String(value);

	return match(inlet.type)
		.with(P.union(...UNMODIFIABLES), () => `$${index}`)
		.with(P.union('int[]', 'float[]'), () => `[${(value as number[]).join(', ')}]`)
		.with('float', () => {
			if (inlet.precision === undefined) return String(value);

			return (value as number)?.toFixed(inlet.precision);
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

	return parsedValue || defaultValue;
};
