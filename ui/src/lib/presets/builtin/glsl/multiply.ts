import type { GLSLPreset } from './types';

const code = `// @title Multiply
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D a;
uniform sampler2D b;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 ca = texture(a, uv);
  vec4 cb = texture(b, uv);
  vec4 multiplied = vec4(ca.rgb * cb.rgb, ca.a * cb.a);
  fragColor = mix(ca, multiplied, opacity);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Multiply two video inputs with an opacity control.',
  data: { code: code.trim() }
};
