import type { GLSLPreset } from './types';

const code = `// @title RGB Key
// @primaryButton settings
// @param minColor color #000000 "Min Color"
// @param maxColor color #808080 "Max Color"
// @param softness 0.05 0.0 0.5 0.001 "Softness"
// @param invert false "Invert"

uniform sampler2D source;
uniform vec3 minColor;
uniform vec3 maxColor;
uniform float softness;
uniform bool invert;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  vec3 lo = min(minColor, maxColor);
  vec3 hi = max(minColor, maxColor);
  vec3 insideLow = softness <= 0.0
    ? step(lo, color.rgb)
    : smoothstep(lo - softness, lo + softness, color.rgb);
  vec3 insideHigh = softness <= 0.0
    ? 1.0 - step(hi, color.rgb)
    : 1.0 - smoothstep(hi - softness, hi + softness, color.rgb);
  float mask = min(min(insideLow.r * insideHigh.r, insideLow.g * insideHigh.g), insideLow.b * insideHigh.b);
  if (invert) mask = 1.0 - mask;

  fragColor = vec4(color.rgb, color.a * mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Create an alpha mask from an RGB color range.',
  data: { code: code.trim() }
};
