import type { GLSLPreset } from './types';

const code = `// @title Anti Alias
// @primaryButton settings
// @param channel 4 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Channel"
// @param threshold 0.5 0.0 1.0 0.001 "Threshold"
// @param softness 0.05 0.0 0.5 0.001 "Softness"
// @param radius 1.0 0.0 4.0 0.001 "Radius"
// @param amount 1.0 0.0 1.0 0.001 "Amount"

uniform sampler2D source;
uniform float channel;
uniform float threshold;
uniform float softness;
uniform float radius;
uniform float amount;

float sampleChannel(vec2 p) {
  vec4 color = texture(source, p);
  if (channel < 0.5) return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (channel < 1.5) return color.r;
  if (channel < 2.5) return color.g;
  if (channel < 3.5) return color.b;
  return color.a;
}

float coverage(vec2 p) {
  float value = sampleChannel(p);
  return smoothstep(threshold - softness, threshold + softness, value);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = radius / iResolution.xy;
  vec4 sourceColor = texture(source, uv);

  float smoothed = coverage(uv) * 0.28;
  smoothed += coverage(uv + vec2(px.x, 0.0)) * 0.12;
  smoothed += coverage(uv - vec2(px.x, 0.0)) * 0.12;
  smoothed += coverage(uv + vec2(0.0, px.y)) * 0.12;
  smoothed += coverage(uv - vec2(0.0, px.y)) * 0.12;
  smoothed += coverage(uv + vec2(px.x, px.y)) * 0.06;
  smoothed += coverage(uv - vec2(px.x, px.y)) * 0.06;
  smoothed += coverage(uv + vec2(px.x, -px.y)) * 0.06;
  smoothed += coverage(uv + vec2(-px.x, px.y)) * 0.06;

  float original = coverage(uv);
  float alpha = mix(original, smoothed, amount);
  fragColor = vec4(sourceColor.rgb, alpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Smooth hard mask edges from a selected source channel.',
  data: { code: code.trim() }
};
