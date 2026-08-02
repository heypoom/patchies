import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Dot Orbit
// @primaryButton settings
// @param colorBack color #09090b "Background"
// @param colorA color #ff006e "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ffbe0b "Color C"
// @param colorD color #3a86ff "Color D"
// @param colorE color #8338ec "Color E"
// @param size 0.42 0.05 1.0 0.001 "Size"
// @param sizeRange 0.4 0.0 1.0 0.001 "Size Range"
// @param spreading 0.35 0.0 1.0 0.001 "Spreading"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, size, sizeRange, spreading

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float size;
uniform float sizeRange;
uniform float spreading;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * 100.0;
  vec2 cell = floor(uv / 72.0);
  vec2 local = fract(uv / 72.0) - 0.5;
  vec2 seed = paperTextureNoise2(cell * 0.031);
  float orbit = iTime + seed.x * TWO_PI;
  vec2 center = spreading * 0.35 * vec2(cos(orbit), sin(orbit * (0.7 + seed.y)));
  float radius = 22.0 * size * (1.0 - sizeRange * seed.y);
  float dotMask = 1.0 - smoothstep(radius, radius + 1.5, length((local - center) * 72.0));
  int colorIndex = int(floor(mod(cell.x + cell.y, 5.0)));
  vec3 color = mix(colorBack, paperPalette(colorIndex, colorA, colorB, colorC, colorD, colorE), dotMask);
  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders orbiting dot grid with a noise texture inlet.',
  data: { code: code.trim() }
};
