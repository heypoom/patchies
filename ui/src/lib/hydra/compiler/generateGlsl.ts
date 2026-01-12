import type { Texture2D } from 'regl';
import type { TransformApplication } from '../glsl/Glsl';
import { formatArguments } from './formatArguments';
import type { TypedArg } from './formatArguments';
import type { ShaderParams } from './compileWithEnvironment';

export type GlslGenerator = (uv: string) => string;

export function generateGlsl(
	transformApplications: TransformApplication[],
	shaderParams: ShaderParams
): GlslGenerator {
	let fragColor: GlslGenerator = () => '';

	transformApplications.forEach((transformApplication) => {
		let f1: (
			uv: string
		) =>
			| string
			| number
			| number[]
			| ((context: any, props: any) => number | number[])
			| Texture2D
			| undefined;

		const typedArgs = formatArguments(transformApplication, shaderParams.uniforms.length);

		typedArgs.forEach((typedArg) => {
			if (typedArg.isUniform) {
				shaderParams.uniforms.push(typedArg);
			}
		});

		// add new glsl function to running list of functions
		if (!contains(transformApplication, shaderParams.transformApplications)) {
			shaderParams.transformApplications.push(transformApplication);
		}

		// current function for generating frag color shader code
		const f0 = fragColor;
		if (transformApplication.transform.type === 'src') {
			fragColor = (uv) => `${shaderString(uv, transformApplication, typedArgs, shaderParams)}`;
		} else if (transformApplication.transform.type === 'coord') {
			fragColor = (uv) =>
				`${f0(`${shaderString(uv, transformApplication, typedArgs, shaderParams)}`)}`;
		} else if (transformApplication.transform.type === 'color') {
			fragColor = (uv) =>
				`${shaderString(`${f0(uv)}`, transformApplication, typedArgs, shaderParams)}`;
		} else if (transformApplication.transform.type === 'combine') {
			// combining two generated shader strings (i.e. for blend, mult, add funtions)
			f1 =
				// @ts-ignore
				typedArgs[0].value && typedArgs[0].value.transforms
					? (uv: string) =>
							// @ts-ignore
							`${generateGlsl(typedArgs[0].value.transforms, shaderParams)(uv)}`
					: typedArgs[0].isUniform
						? () => typedArgs[0].name
						: () => typedArgs[0].value;
			fragColor = (uv) =>
				`${shaderString(
					`${f0(uv)}, ${f1(uv)}`,
					transformApplication,
					typedArgs.slice(1),
					shaderParams
				)}`;
		} else if (transformApplication.transform.type === 'combineCoord') {
			// combining two generated shader strings (i.e. for modulate functions)
			f1 =
				// @ts-ignore
				typedArgs[0].value && typedArgs[0].value.transforms
					? (uv: string) =>
							// @ts-ignore
							`${generateGlsl(typedArgs[0].value.transforms, shaderParams)(uv)}`
					: typedArgs[0].isUniform
						? () => typedArgs[0].name
						: () => typedArgs[0].value;
			fragColor = (uv) =>
				`${f0(
					`${shaderString(
						`${uv}, ${f1(uv)}`,
						transformApplication,
						typedArgs.slice(1),
						shaderParams
					)}`
				)}`;
		}
	});
	return fragColor;
}

function shaderString(
	uv: string,
	transformApplication: TransformApplication,
	inputs: TypedArg[],
	shaderParams: ShaderParams
): string {
	const str = inputs
		.map((input) => {
			if (input.isUniform) {
				return input.name;
				// @ts-ignore
			} else if (input.value && input.value.transforms) {
				// this by definition needs to be a generator, hence we start with 'st' as the initial value for generating the glsl fragment
				// @ts-ignore
				return `${generateGlsl(input.value.transforms, shaderParams)('st')}`;
			}
			return input.value;
		})
		.reduce((p, c) => `${p}, ${c}`, '');

	return `${transformApplication.transform.name}(${uv}${str})`;
}

function contains(
	transformApplication: TransformApplication,
	transformApplications: TransformApplication[]
): boolean {
	for (let i = 0; i < transformApplications.length; i++) {
		if (transformApplication.transform.name == transformApplications[i].transform.name) {
			return true;
		}
	}
	return false;
}
