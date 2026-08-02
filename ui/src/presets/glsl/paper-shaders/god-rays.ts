import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper God Rays
// @primaryButton settings
// @param colorBack color #030303 "Background"
// @param colorBloom color #fff3b0 "Bloom"
// @param colorA color #ffbe0b "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ff006e "Color C"
// @param colorD color #8338ec "Color D"
// @param colorE color #3a86ff "Color E"
// @param density 7.0 1.0 24.0 0.001 "Density"
// @param spotty 0.35 0.0 1.0 0.001 "Spotty"
// @param intensity 0.8 0.0 2.0 0.001 "Intensity"
// @param bloom 0.35 0.0 1.0 0.001 "Bloom"
// @noinlet colorBack, colorBloom, colorA, colorB, colorC, colorD, colorE, density, spotty, intensity, bloom

uniform vec3 colorBack;
uniform vec3 colorBloom;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float density;
uniform float spotty;
uniform float intensity;
uniform float bloom;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float ray = pow(max(0.0, sin(angle * density + paperTextureNoise(vec2(angle, radius) * 0.35) * spotty * 8.0 + iTime * 0.25)), 3.0);
  float center = pow(1.0 - smoothstep(0.0, 0.9, radius), 2.0);
  float light = intensity * ray * (1.0 - smoothstep(0.0, 1.1, radius)) + bloom * center;
  vec3 rayColor = paperGradient(fract(angle / TWO_PI + 0.5), colorA, colorB, colorC, colorD, colorE);
  vec3 color = mix(colorBack, rayColor, clamp(light, 0.0, 1.0));
  color = mix(color, colorBloom, bloom * center);
  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders radial light rays with a noise texture inlet.',
  data: { code: code.trim() }
};
