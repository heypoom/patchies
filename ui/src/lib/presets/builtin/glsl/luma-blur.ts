import type { GLSLPreset } from './types';

const code = `// @title Luma Blur
// @primaryButton settings
// @param radius 18.0 0.0 80.0 0.001 "Radius"
// @param threshold 0.55 0.0 1.0 0.001 "Threshold"
// @param softness 0.2 0.0 1.0 0.001 "Softness"
// @param amount 1.0 0.0 1.0 0.001 "Amount"
// @param mode 0 (0: Bright, 1: Dark) "Mode"

uniform sampler2D source;
uniform float radius;
uniform float threshold;
uniform float softness;
uniform float amount;
uniform float mode;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec4 blurSource(vec2 p) {
  vec2 texel = 1.0 / iResolution.xy;
  vec2 px = texel * radius;
  vec2 diagonal = px * 0.70710678;

  vec4 color = texture(source, p) * 0.16;
  color += texture(source, p + vec2(px.x * 0.5, 0.0)) * 0.10;
  color += texture(source, p - vec2(px.x * 0.5, 0.0)) * 0.10;
  color += texture(source, p + vec2(0.0, px.y * 0.5)) * 0.10;
  color += texture(source, p - vec2(0.0, px.y * 0.5)) * 0.10;
  color += texture(source, p + diagonal) * 0.06;
  color += texture(source, p - diagonal) * 0.06;
  color += texture(source, p + vec2(diagonal.x, -diagonal.y)) * 0.06;
  color += texture(source, p + vec2(-diagonal.x, diagonal.y)) * 0.06;
  color += texture(source, p + vec2(px.x * 1.5, 0.0)) * 0.05;
  color += texture(source, p - vec2(px.x * 1.5, 0.0)) * 0.05;
  color += texture(source, p + vec2(0.0, px.y * 1.5)) * 0.05;
  color += texture(source, p - vec2(0.0, px.y * 1.5)) * 0.05;
  return color;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 sourceColor = texture(source, uv);
  vec4 blurred = blurSource(uv);
  float value = luma(sourceColor.rgb);
  float gate = mode < 0.5
    ? smoothstep(threshold - softness, threshold + softness, value)
    : 1.0 - smoothstep(threshold - softness, threshold + softness, value);

  fragColor = mix(sourceColor, blurred, gate * amount);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Blur a source texture selectively by bright or dark luminance regions.',
  data: { code: code.trim() }
};
