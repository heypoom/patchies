import type { GLSLPreset } from './types';

const code = `// @title Emboss
// @primaryButton settings
// @param strength 1.0 0.0 5.0 0.001 "Strength"
// @param angle 0.7854 -3.1416 3.1416 0.001 "Angle"
// @param distance 1.0 0.25 8.0 0.001 "Distance"
// @param bias 0.5 0.0 1.0 0.001 "Bias"
// @param monochrome false "Monochrome"

uniform sampler2D source;
uniform float strength;
uniform float angle;
uniform float distance;
uniform float bias;
uniform bool monochrome;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 direction = vec2(cos(angle), sin(angle)) * distance / iResolution.xy;
  vec4 forward = texture(source, uv + direction);
  vec4 backward = texture(source, uv - direction);
  vec4 sourceColor = texture(source, uv);
  vec3 embossed = (forward.rgb - backward.rgb) * strength + bias;

  if (monochrome) {
    float value = (luma(forward.rgb) - luma(backward.rgb)) * strength + bias;
    embossed = vec3(value);
  }

  fragColor = vec4(clamp(embossed, 0.0, 1.0), sourceColor.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Emboss a source texture by comparing neighboring samples.',
  data: { code: code.trim() }
};
