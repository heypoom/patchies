import type { GLSLPreset } from './types';

const code = `// @title Rectangle
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param width 0.6 0.0 1.0 0.001 "Width"
// @param height 0.35 0.0 1.0 0.001 "Height"
// @param rotation 0.0 -3.1416 3.1416 0.001 "Rotation"
// @param feather 0.02 0.0 0.5 0.001 "Feather"
// @param color color #ffffff "Color"
// @param alpha 1.0 0.0 1.0 0.001 "Alpha"

uniform float centerX;
uniform float centerY;
uniform float width;
uniform float height;
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

  vec2 size = vec2(width, height) * 0.5 * aspect;
  float mask = boxMask(p, size, feather);
  fragColor = vec4(color, alpha * mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a feathered rectangle shape with rotation and alpha output.',
  data: { code: code.trim() }
};
