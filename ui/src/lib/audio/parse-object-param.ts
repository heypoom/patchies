import { objectDefinitions, type ObjectInlet } from '$lib/objects/objectDefinitions';
import { match, P } from 'ts-pattern';
import JSON5 from 'json5';

export const parseStringParamByType = (inlet: ObjectInlet, strValue: string) =>
	match(inlet.type)
		.with('signal', () => null)
		.with('bang', () => null)
		.with('int', () => parseInt(strValue) || (inlet.defaultValue ?? 0))
		.with('float', () => parseFloat(strValue) || (inlet.defaultValue ?? 0))
		.with('float[]', () => {
			const parsed = JSON5.parse(strValue);
			if (!Array.isArray(parsed)) return inlet.defaultValue ?? [];

			return parsed.map((v) => parseFloat(v) || 0);
		})
		.with('int[]', () => {
			const parsed = JSON5.parse(strValue);
			if (!Array.isArray(parsed)) return inlet.defaultValue ?? [];

			return parsed.map((v) => parseInt(v) || 0);
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
