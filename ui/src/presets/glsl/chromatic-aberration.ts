import type { GLSLPreset } from './types';

const code = `// @title Chromatic Aberration
// @primaryButton settings
// @param amount 0.012 0.0 0.12 0.0001 "Amount"
// @param angle 0.0 -3.1416 3.1416 0.0001 "Angle"
// @param centerX 0.5 0.0 1.0 0.001 "Center X"
// @param centerY 0.5 0.0 1.0 0.001 "Center Y"
// @param falloff 1.0 0.0 4.0 0.001 "Falloff"
// @param mixAmount 1.0 0.0 1.0 0.001 "Mix"

uniform sampler2D source;
uniform float amount;
uniform float angle;
uniform float centerX;
uniform float centerY;
uniform float falloff;
uniform float mixAmount;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 centered = uv - vec2(centerX, centerY);
  vec2 direction = vec2(cos(angle), sin(angle));
  float radial = length(centered) * 1.41421356;
  float strength = amount * mix(1.0, pow(clamp(radial, 0.0, 1.0), falloff), step(0.0001, falloff));
  vec2 offset = direction * strength;

  vec4 original = texture(source, uv);
  float red = texture(source, uv + offset).r;
  float green = texture(source, uv).g;
  float blue = texture(source, uv - offset).b;
  vec3 shifted = vec3(red, green, blue);

  fragColor = vec4(mix(original.rgb, shifted, mixAmount), original.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Separate RGB channels for a directional chromatic aberration effect.',
  data: { code: code.trim() }
};
