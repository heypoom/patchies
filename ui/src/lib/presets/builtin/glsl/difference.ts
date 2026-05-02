import type { GLSLPreset } from './types';

const code = `// @title Difference
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"
// @param monochrome false "Monochrome"

uniform sampler2D a;
uniform sampler2D b;
uniform float opacity;
uniform bool monochrome;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 ca = texture(a, uv);
  vec4 cb = texture(b, uv);
  vec3 diff = abs(ca.rgb - cb.rgb);

  if (monochrome) {
    float luma = dot(diff, vec3(0.299, 0.587, 0.114));
    diff = vec3(luma);
  }

  vec4 difference = vec4(diff, max(ca.a, cb.a));
  fragColor = mix(ca, difference, opacity);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Show the absolute difference between two textures.',
  data: { code: code.trim() }
};
