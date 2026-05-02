import type { GLSLPreset } from './types';

const code = `// @title Slope
// @primaryButton settings
// @param strength 4.0 0.0 20.0 0.001 "Strength"
// @param channel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Channel"
// @param mode 0 (0: Signed RGB, 1: Magnitude, 2: Direction) "Mode"

uniform sampler2D source;
uniform float strength;
uniform float channel;
uniform float mode;

float sampleHeight(vec2 p) {
  vec4 color = texture(source, p);
  if (channel < 0.5) return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (channel < 1.5) return color.r;
  if (channel < 2.5) return color.g;
  if (channel < 3.5) return color.b;
  return color.a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = 1.0 / iResolution.xy;
  float left = sampleHeight(uv - vec2(px.x, 0.0));
  float right = sampleHeight(uv + vec2(px.x, 0.0));
  float down = sampleHeight(uv - vec2(0.0, px.y));
  float up = sampleHeight(uv + vec2(0.0, px.y));
  vec2 slope = vec2(right - left, up - down) * strength;

  if (mode < 0.5) {
    fragColor = vec4(slope * 0.5 + 0.5, 0.5, 1.0);
  } else if (mode < 1.5) {
    fragColor = vec4(vec3(length(slope)), 1.0);
  } else {
    float angle = atan(slope.y, slope.x) / 6.2831853 + 0.5;
    fragColor = vec4(vec3(angle), 1.0);
  }
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Visualize image gradients as signed slope, magnitude, or direction.',
  data: { code: code.trim() }
};
