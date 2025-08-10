import { match, P } from 'ts-pattern';
import type { ObjectDataType, ObjectInlet } from './object-definitions';

// Helper function to validate inlet/outlet types
export const validateMessageToObject = (value: unknown, inlet: ObjectInlet): boolean => {
	if (!inlet.type) return true;

	const isTypeValid = match<[unknown, ObjectDataType]>([value, inlet.type])
		.with([P.any, P.union('signal', 'any')], () => true)
		.with([{ type: 'bang' }, 'bang'], () => true)
		.with([P.number, 'float'], () => true)
		.with([P.number, 'int'], ([n]) => Number.isInteger(n))
		.with([P.string, 'string'], () => true)
		.with([P.boolean, 'bool'], () => true)
		.with([P.array(P.number), 'int[]'], ([arr]) => arr.every(Number.isInteger))
		.with([P.array(P.number), 'float[]'], () => true)
		.otherwise(() => false);

	if (!isTypeValid) return false;

	// Message contains an invalid option
	if (inlet.options && !inlet.options.includes(value)) return false;

	// Message contains a number that is out of range
	if (typeof value === 'number') {
		const isNumberTooHigh = inlet.minNumber !== undefined && value < inlet.minNumber;
		const isNumberTooLow = inlet.maxNumber !== undefined && value > inlet.maxNumber;
		if (isNumberTooLow || isNumberTooHigh) return false;
	}

	return true;
};
