import type { GLSLPreset } from './types';

const code = `// @title Radial Ramp
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param radius 0.5 0.01 1.5 0.001 "Radius"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float centerX;
uniform float centerY;
uniform float radius;
uniform float offset;
uniform vec3 colorA;
uniform vec3 colorB;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 center = vec2(centerX, centerY);
  float value = distance(uv, center) / max(radius, 0.001) + offset;

  fragColor = vec4(mix(colorA, colorB, clamp(value, 0.0, 1.0)), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a radial color ramp from a center point.',
  data: { code: code.trim() }
};
