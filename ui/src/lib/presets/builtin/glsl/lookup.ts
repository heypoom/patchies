import type { GLSLPreset } from './types';

const code = `// @title Lookup
// @primaryButton settings
// @param channel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Channel"
// @param amount 1.0 0.0 1.0 0.001 "Amount"

uniform sampler2D source;
uniform sampler2D lookup;
uniform float channel;
uniform float amount;

float sampleChannel(vec4 color) {
  if (channel < 0.5) return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (channel < 1.5) return color.r;
  if (channel < 2.5) return color.g;
  if (channel < 3.5) return color.b;
  return color.a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float index = clamp(sampleChannel(color), 0.0, 1.0);
  vec3 lookedUp = texture(lookup, vec2(index, 0.5)).rgb;

  fragColor = vec4(mix(color.rgb, lookedUp, amount), color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Map a source channel through a horizontal 1D lookup texture.',
  data: { code: code.trim() }
};
