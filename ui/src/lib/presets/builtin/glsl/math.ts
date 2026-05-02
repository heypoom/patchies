import type { GLSLPreset } from './types';

const code = `// @title Math
// @primaryButton settings
// @param operation 0 (0: Add, 1: Subtract, 2: Multiply, 3: Divide, 4: Min, 5: Max, 6: Difference, 7: Average) "Operation"
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"
// @param offset 0.0 -1.0 1.0 0.001 "Offset"
// @param scale 1.0 -4.0 4.0 0.001 "Scale"
// @param clampOutput true "Clamp Output"

uniform sampler2D a;
uniform sampler2D b;
uniform float operation;
uniform float opacity;
uniform float offset;
uniform float scale;
uniform bool clampOutput;

vec3 mathOp(vec3 ca, vec3 cb) {
  if (operation < 0.5) return ca + cb;
  if (operation < 1.5) return ca - cb;
  if (operation < 2.5) return ca * cb;
  if (operation < 3.5) return ca / max(cb, vec3(0.0001));
  if (operation < 4.5) return min(ca, cb);
  if (operation < 5.5) return max(ca, cb);
  if (operation < 6.5) return abs(ca - cb);
  return (ca + cb) * 0.5;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 ca = texture(a, uv);
  vec4 cb = texture(b, uv);
  vec3 result = mathOp(ca.rgb, cb.rgb) * scale + offset;
  vec3 rgb = mix(ca.rgb, result, opacity);
  float alpha = max(ca.a, cb.a * opacity);

  fragColor = vec4(rgb, alpha);
  if (clampOutput) fragColor = clamp(fragColor, 0.0, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Combine two textures with selectable per-pixel math operations.',
  data: { code: code.trim() }
};
