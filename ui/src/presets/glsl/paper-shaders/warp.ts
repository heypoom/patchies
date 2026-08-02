import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Warp
// @primaryButton settings
// @param colorA color #ffbe0b "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ff006e "Color C"
// @param colorD color #8338ec "Color D"
// @param colorE color #3a86ff "Color E"
// @param scale 1.3 0.2 6.0 0.001 "Scale"
// @param softness 0.45 0.0 1.0 0.001 "Softness"
// @param shape 0.4 0.0 1.0 0.001 "Shape"
// @param distortion 0.45 0.0 1.0 0.001 "Distortion"
// @param swirl 0.35 0.0 1.0 0.001 "Swirl"
// @noinlet colorA, colorB, colorC, colorD, colorE, scale, softness, shape, distortion, swirl

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float scale;
uniform float softness;
uniform float shape;
uniform float distortion;
uniform float swirl;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * scale;
  float r = length(uv);
  uv = rotate(uv, swirl * r * 4.0);
  vec2 n = vec2(paperTextureNoise(uv * 0.13 + iTime * 0.02), paperTextureNoise(uv.yx * 0.13 - iTime * 0.015));
  uv += distortion * (n - 0.5) * 2.0;
  float stripes = 0.5 + 0.5 * sin(uv.x * PI + shape * sin(uv.y * TWO_PI));
  float smoke = 0.5 + 0.5 * snoise(uv * 2.0 + 0.05 * iTime);
  float v = mix(stripes, smoke, softness);
  fragColor = vec4(paperGradient(v, colorA, colorB, colorC, colorD, colorE), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Warped Paper Shaders color field with a noise texture inlet.',
  data: { code: code.trim() }
};
