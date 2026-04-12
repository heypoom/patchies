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
  arraySize?: number;

  /** From `// @param` directive */
  default?: number | boolean;
  min?: number;
  max?: number;
  description?: string;

  /** Widget override — e.g. 'color' renders a vec3 as a color picker */
  widget?: 'color';
}
