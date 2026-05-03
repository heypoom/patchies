import type { GLSLPreset } from './types';

const code = `// @title Remap
// @primaryButton settings
// @param inMin 0.0 -2.0 2.0 0.001 "Input Min"
// @param inMax 1.0 -2.0 2.0 0.001 "Input Max"
// @param outMin 0.0 -2.0 2.0 0.001 "Output Min"
// @param outMax 1.0 -2.0 2.0 0.001 "Output Max"
// @param clampOutput true "Clamp Output"
// @noinlet clampOutput

uniform sampler2D source;
uniform float inMin;
uniform float inMax;
uniform float outMin;
uniform float outMax;
uniform bool clampOutput;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float inputRange = max(inMax - inMin, 0.0001);
  vec3 normalized = (color.rgb - inMin) / inputRange;
  if (clampOutput) normalized = clamp(normalized, 0.0, 1.0);
  vec3 remapped = mix(vec3(outMin), vec3(outMax), normalized);

  fragColor = vec4(remapped, color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Remap RGB values from one range into another.',
  data: { code: code.trim() }
};
