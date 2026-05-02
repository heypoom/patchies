import type { GLSLPreset } from './types';

const code = `// @title Normal Map
// @primaryButton settings
// @param strength 4.0 0.0 20.0 0.001 "Strength"
// @param channel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Channel"
// @param invertY false "Invert Y"

uniform sampler2D source;
uniform float strength;
uniform float channel;
uniform bool invertY;

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
  float ySign = invertY ? -1.0 : 1.0;
  vec3 normal = normalize(vec3((left - right) * strength, (down - up) * strength * ySign, 1.0));

  fragColor = vec4(normal * 0.5 + 0.5, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate an approximate normal map from source height or luma.',
  data: { code: code.trim() }
};
