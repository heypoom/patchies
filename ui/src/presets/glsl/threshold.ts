import type { GLSLPreset } from './types';

const code = `// @title Threshold
// @primaryButton settings
// @param threshold 0.5 0.0 1.0 0.001 "Threshold"
// @param softness 0.02 0.0 0.5 0.001 "Softness"
// @param channel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Channel"
// @param invert false "Invert"

uniform sampler2D source;
uniform float threshold;
uniform float softness;
uniform float channel;
uniform bool invert;

float sampleChannel(vec4 color) {
  if (channel < 0.5) return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (channel < 1.5) return color.r;
  if (channel < 2.5) return color.g;
  if (channel < 3.5) return color.b;
  return color.a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float value = sampleChannel(color);
  float mask = smoothstep(threshold - softness, threshold + softness, value);
  if (invert) mask = 1.0 - mask;

  fragColor = vec4(color.rgb, color.a * mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Create an alpha mask from a thresholded texture channel.',
  data: { code: code.trim() }
};
