// Modified from hydra-ts (AGPL-3.0) - January 2025
// Changed console.log to configurable error handler for virtual console support

import { Glsl } from '../glsl/Glsl';
import type { TransformApplication } from '../glsl/Glsl';
import arrayUtils from '../lib/array-utils';
import type {
	TransformDefinitionInput,
	TransformDefinitionType
} from '../glsl/transformDefinitions';
import { Source } from '../Source';
import { Output } from '../Output';
import { src } from '../glsl/index';

export interface HydraErrorContext {
	transformName: string;
	transformType: TransformDefinitionType;
	paramName: string;
	paramIndex: number;
	paramType: string;
}

export type HydraErrorHandler = (error: unknown, context: HydraErrorContext) => void;

// Default no-op error handler
const defaultOnError: HydraErrorHandler = () => {};

export interface TypedArg {
	value: TransformDefinitionInput['default'];
	type: TransformDefinitionInput['type'];
	isUniform: boolean;
	name: TransformDefinitionInput['name'];
	vecLen: number;
}

export function formatArguments(
	transformApplication: TransformApplication,
	startIndex: number,
	onError: HydraErrorHandler = defaultOnError
): TypedArg[] {
	const { transform, userArgs } = transformApplication;
	const { inputs } = transform;

	return inputs.map((input, index) => {
		const vecLen = input.vecLen ?? 0;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let value: any = input.default;
		let isUniform = false;

		if (input.type === 'float') {
			value = ensureDecimalDot(value);
		}

		// if user has input something for this argument
		if (userArgs.length > index) {
			const arg = userArgs[index];

			value = arg;
			// do something if a composite or transformApplication

			if (typeof arg === 'function') {
				if (vecLen > 0) {
					// expected input is a vector, not a scalar
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					value = (context: any, props: any) => fillArrayWithDefaults(arg(props), vecLen);
				} else {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					value = (context: any, props: any) => {
						try {
							return arg(props);
						} catch (e) {
							onError(e, {
								transformName: transform.name,
								transformType: transform.type,
								paramName: input.name,
								paramIndex: index,
								paramType: input.type
							});

							return input.default;
						}
					};
				}

				isUniform = true;
			} else if (Array.isArray(arg)) {
				if (vecLen > 0) {
					// expected input is a vector, not a scalar
					isUniform = true;
					value = fillArrayWithDefaults(value, vecLen);
				} else {
					// is Array
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					value = (context: any, props: any) => arrayUtils.getValue(arg)(props);
					isUniform = true;
				}
			}
		}

		if (value instanceof Glsl) {
			// GLSLSource

			isUniform = false;
		} else if (input.type === 'float' && typeof value === 'number') {
			// Number

			value = ensureDecimalDot(value);
		} else if (input.type.startsWith('vec') && Array.isArray(value)) {
			// Vector literal (as array)

			isUniform = false;
			value = `${input.type}(${value.map(ensureDecimalDot).join(', ')})`;
		} else if (input.type === 'sampler2D') {
			const ref = value;

			value = () => ref.getTexture();
			isUniform = true;
		} else if (value instanceof Source || value instanceof Output) {
			const ref = value;

			value = src(ref);
			isUniform = false;
		}

		// Add to uniform array if is a function that will pass in a different value on each render frame,
		// or a texture/ external source

		let { name } = input;
		if (isUniform) {
			name += startIndex;
		}

		return {
			value,
			type: input.type,
			isUniform,
			vecLen,
			name
		};
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ensureDecimalDot(val: any): string {
	val = val.toString();
	if (val.indexOf('.') < 0) {
		val += '.';
	}
	return val;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fillArrayWithDefaults(arr: any[], len: number) {
	// fill the array with default values if it's too short
	while (arr.length < len) {
		if (arr.length === 3) {
			// push a 1 as the default for .a in vec4
			arr.push(1.0);
		} else {
			arr.push(0.0);
		}
	}
	return arr.slice(0, len);
}
