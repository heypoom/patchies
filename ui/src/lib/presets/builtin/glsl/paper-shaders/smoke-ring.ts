import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Smoke Ring
// @primaryButton settings
// @param colorBack color #050505 "Background"
// @param colorA color #f72585 "Color A"
// @param colorB color #b5179e "Color B"
// @param colorC color #7209b7 "Color C"
// @param colorD color #3a0ca3 "Color D"
// @param colorE color #4cc9f0 "Color E"
// @param thickness 0.18 0.01 0.8 0.001 "Thickness"
// @param radius 0.42 0.05 1.2 0.001 "Radius"
// @param innerShape 0.35 0.0 1.0 0.001 "Inner Shape"
// @param noiseScale 2.2 0.1 8.0 0.001 "Noise Scale"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, thickness, radius, innerShape, noiseScale

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float thickness;
uniform float radius;
uniform float innerShape;
uniform float noiseScale;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float n = paperTextureNoise(uv * noiseScale + vec2(0.04 * iTime, -0.03 * iTime));
  float d = length(uv + 0.12 * (n - 0.5));
  float ring = 1.0 - smoothstep(thickness, thickness + 0.12, abs(d - radius));
  float hole = smoothstep(innerShape * radius, radius, d);
  float mask = ring * hole;
  vec3 color = paperGradient(fract(n + d), colorA, colorB, colorC, colorD, colorE);
  fragColor = vec4(mix(colorBack, color, mask), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders smoky radial ring with a noise texture inlet.',
  data: { code: code.trim() }
};
