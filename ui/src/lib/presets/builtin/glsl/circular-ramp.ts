import type { GLSLPreset } from './types';

const code = `// @title Circular Ramp
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param angle 0.0 -3.1416 3.1416 0.001 "Angle"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param colorA color #000000 "Color A"
// @param colorB color #ffffff "Color B"

uniform float centerX;
uniform float centerY;
uniform float angle;
uniform float offset;
uniform vec3 colorA;
uniform vec3 colorB;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - vec2(centerX, centerY);
  float value = atan(p.y, p.x) / 6.28318530718 + 0.5 + angle / 6.28318530718 + offset;
  value = fract(value);

  fragColor = vec4(mix(colorA, colorB, clamp(value, 0.0, 1.0)), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate an angular color ramp around a center point.',
  data: { code: code.trim() }
};
