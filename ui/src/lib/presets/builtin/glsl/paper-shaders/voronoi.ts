import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Voronoi
// @primaryButton settings
// @param colorA color #03045e "Color A"
// @param colorB color #0077b6 "Color B"
// @param colorC color #00b4d8 "Color C"
// @param colorD color #90e0ef "Color D"
// @param colorE color #caf0f8 "Color E"
// @param colorGlow color #ffffff "Glow"
// @param colorGap color #050505 "Gap"
// @param scale 2.4 0.5 10.0 0.001 "Scale"
// @param distortion 0.35 0.0 1.0 0.001 "Distortion"
// @param gap 0.04 0.0 0.3 0.001 "Gap"
// @param glow 0.25 0.0 1.0 0.001 "Glow"
// @noinlet colorA, colorB, colorC, colorD, colorE, colorGlow, colorGap, scale, distortion, gap, glow

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform vec3 colorGlow;
uniform vec3 colorGap;
uniform float scale;
uniform float distortion;
uniform float gap;
uniform float glow;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * scale;
  vec2 cell = floor(uv);
  vec2 local = fract(uv);
  float minDist = 9.0;
  vec2 closest = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 seed = paperTextureNoise2((cell + neighbor) * 0.071);
      vec2 point = neighbor + 0.5 + 0.35 * distortion * sin(iTime + TWO_PI * seed) - local;
      float d = length(point);
      if (d < minDist) {
        minDist = d;
        closest = cell + neighbor;
      }
    }
  }
  float edge = smoothstep(gap, gap + 0.025, minDist);
  float halo = glow * pow(1.0 - smoothstep(0.0, 0.7, minDist), 2.0);
  float paletteIndex = fract(hash21(closest) * 1.3);
  vec3 color = paperGradient(paletteIndex, colorA, colorB, colorC, colorD, colorE);
  color = mix(colorGap, color, edge);
  color = mix(color, colorGlow, halo);
  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders Voronoi cells with a noise texture inlet.',
  data: { code: code.trim() }
};
