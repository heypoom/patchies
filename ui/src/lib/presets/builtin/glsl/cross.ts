import type { GLSLPreset } from './types';

const code = `// @title Cross
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param size 0.65 0.0 1.5 0.001 "Size"
// @param thickness 0.08 0.0 0.5 0.001 "Thickness"
// @param rotation 0.0 -3.1416 3.1416 0.001 "Rotation"
// @param feather 0.02 0.0 0.5 0.001 "Feather"
// @param color color #ffffff "Color"
// @param alpha 1.0 0.0 1.0 0.001 "Alpha"

uniform float centerX;
uniform float centerY;
uniform float size;
uniform float thickness;
uniform float rotation;
uniform float feather;
uniform vec3 color;
uniform float alpha;

float boxMask(vec2 p, vec2 halfSize, float softness) {
  vec2 d = abs(p) - halfSize;
  float outside = length(max(d, 0.0));
  float inside = min(max(d.x, d.y), 0.0);
  float dist = outside + inside;
  return 1.0 - smoothstep(0.0, softness, dist);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 aspect = vec2(iResolution.x / max(iResolution.y, 0.0001), 1.0);
  vec2 p = (uv - vec2(centerX, centerY)) * aspect;
  float c = cos(rotation);
  float s = sin(rotation);
  p = mat2(c, -s, s, c) * p;

  float halfLength = size * 0.5;
  float halfThickness = thickness * 0.5;
  float horizontal = boxMask(p, vec2(halfLength * aspect.x, halfThickness), feather);
  float vertical = boxMask(p, vec2(halfThickness * aspect.x, halfLength), feather);
  float mask = max(horizontal, vertical);

  fragColor = vec4(color, alpha * mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a feathered cross shape for masks and calibration visuals.',
  data: { code: code.trim() }
};
