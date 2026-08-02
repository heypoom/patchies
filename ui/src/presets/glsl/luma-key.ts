import type { GLSLPreset } from './types';

const code = `// @title Luma Key
// @primaryButton settings
// @param threshold 0.5 0.0 1.0 0.001 "Threshold"
// @param softness 0.08 0.0 0.5 0.001 "Softness"
// @param invert false "Invert"

uniform sampler2D source;
uniform float threshold;
uniform float softness;
uniform bool invert;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float mask = softness <= 0.0
    ? step(threshold, luma)
    : smoothstep(threshold - softness, threshold + softness, luma);
  if (invert) mask = 1.0 - mask;

  fragColor = vec4(color.rgb, color.a * mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Create an alpha mask from source luminance.',
  data: { code: code.trim() }
};
