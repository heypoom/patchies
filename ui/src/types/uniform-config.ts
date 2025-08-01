export type GLUniformType =
	| 'float'
	| 'int'
	| 'bool'
	| 'vec2'
	| 'vec3'
	| 'vec4'
	| 'sampler2D'
	| 'samplerCube'
	| 'mat2'
	| 'mat3'
	| 'mat4';

export interface GLUniformDef {
	name: string;
	type: GLUniformType;
}
