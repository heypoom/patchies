import type { GLSLPreset } from './types';

const code = `// @title Constant
// @primaryButton settings
// @param iColor color "Color"
// @param alpha 1.0 0.0 1.0 0.001 "Alpha"

uniform vec3 iColor;
uniform float alpha;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(iColor, alpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a constant color and alpha.',
  data: { code: code.trim() }
};
