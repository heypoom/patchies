import type { GLSLPreset } from './types';

const code = `// @title Circle
// @primaryButton settings
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param radius 0.3 0.0 1.0 0.001 "Radius"
// @param feather 0.02 0.0 0.5 0.001 "Feather"
// @param color color #ffffff "Color"
// @param alpha 1.0 0.0 1.0 0.001 "Alpha"

uniform float centerX;
uniform float centerY;
uniform float radius;
uniform float feather;
uniform vec3 color;
uniform float alpha;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 aspect = vec2(iResolution.x / max(iResolution.y, 0.0001), 1.0);
  vec2 p = (uv - vec2(centerX, centerY)) * aspect;
  float dist = length(p);
  float mask = 1.0 - smoothstep(radius, radius + feather, dist);

  fragColor = vec4(color, alpha * mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a feathered circle shape with useful alpha output.',
  data: { code: code.trim() }
};
