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

  /** From `// @param` directive — string for hex color defaults (e.g. '#ff6600') */
  default?: number | boolean | string;
  min?: number;
  max?: number;
  description?: string;

  /** Select options for enum-like numeric uniforms. Values are sent to GL as numbers. */
  options?: { label: string; value: string }[];

  /** Widget override — e.g. 'color' renders a vec3 as a color picker */
  widget?: 'color' | 'select';
}
