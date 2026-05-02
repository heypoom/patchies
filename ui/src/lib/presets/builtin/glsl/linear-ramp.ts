import type { GLSLPreset } from './types';

const code = `// @title Linear Ramp
// @primaryButton settings
// @param angle 0.0 -3.1416 3.1416 0.001 "Angle"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float angle;
uniform float offset;
uniform vec3 colorA;
uniform vec3 colorB;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - 0.5;
  float c = cos(angle);
  float s = sin(angle);
  float value = dot(p, vec2(c, s)) + 0.5 + offset;

  fragColor = vec4(mix(colorA, colorB, clamp(value, 0.0, 1.0)), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a directional linear color ramp.',
  data: { code: code.trim() }
};
