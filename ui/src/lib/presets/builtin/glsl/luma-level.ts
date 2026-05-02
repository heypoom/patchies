import type { GLSLPreset } from './types';

const code = `// @title Luma Level
// @primaryButton settings
// @param black 0.0 0.0 1.0 0.001 "Black"
// @param white 1.0 0.0 1.0 0.001 "White"
// @param gamma 1.0 0.1 4.0 0.001 "Gamma"
// @param brightness 0.0 -1.0 1.0 0.001 "Brightness"
// @param contrast 1.0 0.0 4.0 0.001 "Contrast"
// @param amount 1.0 0.0 1.0 0.001 "Amount"

uniform sampler2D source;
uniform float black;
uniform float white;
uniform float gamma;
uniform float brightness;
uniform float contrast;
uniform float amount;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float adjustLuma(float value) {
  float range = max(white - black, 0.0001);
  float adjusted = clamp((value - black) / range, 0.0, 1.0);
  adjusted = pow(adjusted, 1.0 / max(gamma, 0.0001));
  adjusted = (adjusted - 0.5) * contrast + 0.5 + brightness;
  return clamp(adjusted, 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float originalLuma = max(luma(color.rgb), 0.0001);
  float targetLuma = adjustLuma(originalLuma);
  vec3 adjustedRgb = color.rgb * (targetLuma / originalLuma);

  fragColor = vec4(mix(color.rgb, adjustedRgb, amount), color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Adjust luminance levels while mostly preserving source hue.',
  data: { code: code.trim() }
};
