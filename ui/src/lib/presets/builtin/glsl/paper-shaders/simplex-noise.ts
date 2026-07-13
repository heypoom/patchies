import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Simplex Noise
// @primaryButton settings
// @param colorA color #10002b "Color A"
// @param colorB color #240046 "Color B"
// @param colorC color #5a189a "Color C"
// @param colorD color #c77dff "Color D"
// @param colorE color #e0aaff "Color E"
// @param scale 1.8 0.1 8.0 0.001 "Scale"
// @param stepsPerColor 1.0 0.1 5.0 0.001 "Steps Per Color"
// @param softness 0.35 0.0 1.0 0.001 "Softness"
// @noinlet colorA, colorB, colorC, colorD, colorE, scale, stepsPerColor, softness

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float scale;
uniform float stepsPerColor;
uniform float softness;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * scale;
  float n = 0.5 + 0.5 * snoise(uv + vec2(0.12 * iTime, -0.08 * iTime));
  float bands = max(1.0, stepsPerColor * 5.0);
  float stepped = floor(n * bands) / bands;
  n = mix(stepped, n, softness);
  fragColor = vec4(paperGradient(n, colorA, colorB, colorC, colorD, colorE), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders simplex noise color field.',
  data: { code: code.trim() }
};
