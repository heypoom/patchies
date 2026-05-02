import type { GLSLPreset } from './types';

const code = `// @title Displace
// @primaryButton settings
// @param amount 0.05 -0.5 0.5 0.001 "Amount"
// @param center 0.5 0.0 1.0 0.001 "Center"
// @param useLuma false "Use Luma"

uniform sampler2D source;
uniform sampler2D displacement;
uniform float amount;
uniform float center;
uniform bool useLuma;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 disp = texture(displacement, uv);
  vec2 offset = disp.rg - center;
  if (useLuma) {
    float luma = dot(disp.rgb, vec3(0.299, 0.587, 0.114)) - center;
    offset = vec2(luma);
  }
  fragColor = texture(source, uv + offset * amount);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Warp an input texture using a displacement texture.',
  data: { code: code.trim() }
};
