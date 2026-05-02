import type { GLSLPreset } from './types';

const code = `// @title Blur
// @primaryButton settings
// @param radius 12.0 0.0 80.0 0.001 "Radius"

uniform sampler2D source;
uniform float radius;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 texel = 1.0 / iResolution.xy;
  vec2 px = texel * radius;
  vec2 diagonal = px * 0.70710678;

  vec4 color = texture(source, uv) * 0.16;
  color += texture(source, uv + vec2(px.x * 0.5, 0.0)) * 0.10;
  color += texture(source, uv - vec2(px.x * 0.5, 0.0)) * 0.10;
  color += texture(source, uv + vec2(0.0, px.y * 0.5)) * 0.10;
  color += texture(source, uv - vec2(0.0, px.y * 0.5)) * 0.10;
  color += texture(source, uv + diagonal) * 0.06;
  color += texture(source, uv - diagonal) * 0.06;
  color += texture(source, uv + vec2(diagonal.x, -diagonal.y)) * 0.06;
  color += texture(source, uv + vec2(-diagonal.x, diagonal.y)) * 0.06;
  color += texture(source, uv + vec2(px.x * 1.5, 0.0)) * 0.05;
  color += texture(source, uv - vec2(px.x * 1.5, 0.0)) * 0.05;
  color += texture(source, uv + vec2(0.0, px.y * 1.5)) * 0.05;
  color += texture(source, uv - vec2(0.0, px.y * 1.5)) * 0.05;

  fragColor = color;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Apply a practical single-pass 2D blur.',
  data: { code: code.trim() }
};
