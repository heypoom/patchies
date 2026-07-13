import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Pulsing Border
// @primaryButton settings
// @param colorBack color #050505 "Background"
// @param colorA color #ff006e "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ffbe0b "Color C"
// @param colorD color #3a86ff "Color D"
// @param colorE color #8338ec "Color E"
// @param roundness 0.25 0.0 1.0 0.001 "Roundness"
// @param thickness 0.08 0.01 0.4 0.001 "Thickness"
// @param softness 0.08 0.0 0.4 0.001 "Softness"
// @param intensity 0.9 0.0 2.0 0.001 "Intensity"
// @param pulse 0.5 0.0 1.0 0.001 "Pulse"
// @param smoke 0.25 0.0 1.0 0.001 "Smoke"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, roundness, thickness, softness, intensity, pulse, smoke

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float roundness;
uniform float thickness;
uniform float softness;
uniform float intensity;
uniform float pulse;
uniform float smoke;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float beat = 0.5 + 0.5 * sin(iTime * 2.4);
  float noisy = smoke * (paperTextureNoise(uv * 1.5 + iTime * 0.02) - 0.5);
  float d = roundedBox(uv + noisy * 0.04, vec2(0.44), roundness * 0.2);
  float border = smoothstep(thickness + softness, thickness - softness, abs(d));
  float glow = exp(-12.0 * abs(d)) * (0.35 + pulse * beat);
  vec3 color = paperGradient(fract(atan(uv.y, uv.x) / TWO_PI + iTime * 0.03), colorA, colorB, colorC, colorD, colorE);
  float amount = clamp(border * intensity + glow * 0.35, 0.0, 1.0);
  fragColor = vec4(mix(colorBack, color, amount), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders pulsing border with a noise texture inlet.',
  data: { code: code.trim() }
};
