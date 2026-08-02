import type { GLSLPreset } from './types';

const code = `// @title Lens Distort
// @primaryButton settings
// @param amount 0.25 -1.0 1.0 0.001 "Amount"
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param scale 1.0 0.1 2.0 0.001 "Scale"
// @param chromatic 0.01 0.0 0.3 0.0001 "Chromatic"

uniform sampler2D source;
uniform float amount;
uniform float centerX;
uniform float centerY;
uniform float scale;
uniform float chromatic;

vec2 distort(vec2 p, float strength) {
  vec2 centered = (p - vec2(centerX, centerY)) / max(scale, 0.0001);
  float r2 = dot(centered, centered);
  return vec2(centerX, centerY) + centered * (1.0 + strength * r2);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 redUv = distort(uv, amount + chromatic);
  vec2 greenUv = distort(uv, amount);
  vec2 blueUv = distort(uv, amount - chromatic);

  float r = texture(source, redUv).r;
  float g = texture(source, greenUv).g;
  float b = texture(source, blueUv).b;
  float a = texture(source, greenUv).a;

  fragColor = vec4(r, g, b, a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Apply barrel or pincushion lens distortion with chromatic offset.',
  data: { code: code.trim() }
};
