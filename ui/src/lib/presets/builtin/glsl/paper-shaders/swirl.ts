import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Swirl
// @primaryButton settings
// @param colorA color #03045e "Color A"
// @param colorB color #0077b6 "Color B"
// @param colorC color #00b4d8 "Color C"
// @param colorD color #90e0ef "Color D"
// @param colorE color #caf0f8 "Color E"
// @param bandCount 5.0 1.0 16.0 0.001 "Bands"
// @param twist 0.9 0.0 2.0 0.001 "Twist"
// @param center 0.35 0.0 1.0 0.001 "Center"
// @param softness 0.35 0.0 1.0 0.001 "Softness"
// @param noise 0.15 0.0 1.0 0.001 "Noise"
// @noinlet colorA, colorB, colorC, colorD, colorE, bandCount, twist, center, softness, noise

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float bandCount;
uniform float twist;
uniform float center;
uniform float softness;
uniform float noise;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float n = noise * snoise(uv * 5.0 + 0.1 * iTime);
  float v = fract((a / TWO_PI) * bandCount + twist * pow(r + center, 0.7) - 0.08 * iTime + n);
  v = mix(floor(v * 5.0) / 5.0, v, softness);
  fragColor = vec4(paperGradient(v, colorA, colorB, colorC, colorD, colorE), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders swirl bands with noise controls.',
  data: { code: code.trim() }
};
