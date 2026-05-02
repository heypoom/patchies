import type { GLSLPreset } from './types';

const code = `// @title Level
// @primaryButton settings
// @param black 0.0 0.0 1.0 0.001 "Black"
// @param white 1.0 0.0 1.0 0.001 "White"
// @param gamma 1.0 0.1 4.0 0.001 "Gamma"
// @param brightness 0.0 -1.0 1.0 0.001 "Brightness"
// @param contrast 1.0 0.0 4.0 0.001 "Contrast"
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D source;
uniform float black;
uniform float white;
uniform float gamma;
uniform float brightness;
uniform float contrast;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float range = max(white - black, 0.0001);
  color.rgb = clamp((color.rgb - black) / range, 0.0, 1.0);
  color.rgb = pow(color.rgb, vec3(1.0 / max(gamma, 0.0001)));
  color.rgb = (color.rgb - 0.5) * contrast + 0.5 + brightness;
  color.a *= opacity;
  fragColor = color;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Adjust black, white, gamma, brightness, contrast, and opacity.',
  data: { code: code.trim() }
};
