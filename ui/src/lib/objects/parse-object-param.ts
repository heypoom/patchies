import { objectDefinitions, type ObjectInlet } from '$lib/objects/object-definitions';
import { match, P } from 'ts-pattern';
import JSON5 from 'json5';

export const parseStringParamByType = (inlet: ObjectInlet, strValue: string) =>
	match(inlet.type)
		.with('signal', () => null)
		.with('bang', () => null)
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

export const stringifyParamByType = (inlet: ObjectInlet, value: unknown, index: number) =>
	match(inlet.type)
		.with(P.union('signal', 'bang'), () => `$${index}`)
		.with(P.union('int[]', 'float[]'), () => `[${(value as number[]).join(', ')}]`)
		.with('float', () => {
			if (inlet.precision === undefined) return String(value);

			return (value as number)?.toFixed(inlet.precision);
		})
		.otherwise(() => String(value));

export const parseObjectParamFromString = (name: string, strValues: string[]) => {
	const definition = objectDefinitions[name];
	if (!definition) return strValues;

	return definition.inlets.map((inlet, inletIndex) =>
		parseStringParamByType(inlet, strValues[inletIndex])
	);
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
