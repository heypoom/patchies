import type { GLSLPreset } from './types';

const code = `// @title Blob Detect
// @primaryButton settings
// @param channel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Channel"
// @param threshold 0.5 0.0 1.0 0.001 "Threshold"
// @param softness 0.05 0.0 0.5 0.001 "Softness"
// @param invert false "Invert"
// @param overlay 0.75 0.0 1.0 0.001 "Overlay"
// @param outline 1.5 0.0 12.0 0.001 "Outline"
// @param highlightColor color #ff3366 "Highlight Color"
// @noinlet channel, threshold, softness, invert, overlay, outline, highlightColor

layout(location = 0) out vec4 visualization;
layout(location = 1) out vec4 maskOutput;

uniform sampler2D source;
uniform float channel;
uniform float threshold;
uniform float softness;
uniform bool invert;
uniform float overlay;
uniform float outline;
uniform vec3 highlightColor;

float sampleChannel(vec4 color) {
  if (channel < 0.5) return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (channel < 1.5) return color.r;
  if (channel < 2.5) return color.g;
  if (channel < 3.5) return color.b;
  return color.a;
}

float valueAt(vec2 coord) {
  vec4 color = texture(source, clamp(coord, vec2(0.0), vec2(1.0)));

  return sampleChannel(color);
}

float maskAt(vec2 coord) {
  float value = valueAt(coord);
  float mask = softness <= 0.0
    ? step(threshold, value)
    : smoothstep(threshold - softness, threshold + softness, value);

  return invert ? 1.0 - mask : mask;
}

float hardMaskAt(vec2 coord) {
  float mask = step(threshold, valueAt(coord));

  return invert ? 1.0 - mask : mask;
}

void mainImage(in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float mask = maskAt(uv);
  vec2 px = (outline / iResolution.xy);

  float edge = 0.0;
  if (outline > 0.0) {
    float hardMask = hardMaskAt(uv);
    float left = hardMaskAt(uv - vec2(px.x, 0.0));
    float right = hardMaskAt(uv + vec2(px.x, 0.0));
    float down = hardMaskAt(uv - vec2(0.0, px.y));
    float up = hardMaskAt(uv + vec2(0.0, px.y));
    edge = max(max(abs(hardMask - left), abs(hardMask - right)), max(abs(hardMask - down), abs(hardMask - up)));
  }

  vec3 detected = mix(color.rgb, highlightColor, mask * overlay);
  vec3 outlined = mix(detected, highlightColor, edge);

  visualization = vec4(outlined, color.a);
  maskOutput = vec4(vec3(mask), mask);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Detect bright or channel-specific regions with visualization and mask outputs.',
  data: { code: code.trim() }
};
