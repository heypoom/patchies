import type { GLSLPreset } from './types';

const code = `// @title Mirror
// @primaryButton settings
// @param axis 0 (0: Horizontal, 1: Vertical, 2: Both) "Axis"
// @param center 0.5 0.0 1.0 0.001 "Center"
// @param blend 0.0 0.0 0.5 0.001 "Blend"

uniform sampler2D source;
uniform float axis;
uniform float center;
uniform float blend;

float mirroredCoordinate(float value, float c) {
  return c - abs(value - c);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv;
  vec2 mirrored = uv;

  if (axis < 0.5 || axis >= 1.5) mirrored.x = mirroredCoordinate(uv.x, center);
  if (axis >= 0.5) mirrored.y = mirroredCoordinate(uv.y, center);

  vec4 original = texture(source, p);
  vec4 reflected = texture(source, mirrored);

  float seam = 1.0;
  if (axis < 0.5 || axis >= 1.5) seam *= smoothstep(0.0, max(blend, 0.0001), abs(uv.x - center));
  if (axis >= 0.5) seam *= smoothstep(0.0, max(blend, 0.0001), abs(uv.y - center));

  fragColor = mix(original, reflected, seam);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Mirror a source texture around a horizontal, vertical, or two-axis center.',
  data: { code: code.trim() }
};
