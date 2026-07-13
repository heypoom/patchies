import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Metaballs
// @primaryButton settings
// @param colorBack color #050505 "Background"
// @param colorA color #f72585 "Color A"
// @param colorB color #b5179e "Color B"
// @param colorC color #7209b7 "Color C"
// @param colorD color #3a0ca3 "Color D"
// @param colorE color #4cc9f0 "Color E"
// @param size 0.32 0.05 1.0 0.001 "Size"
// @param sizeRange 0.4 0.0 1.0 0.001 "Size Range"
// @param count 7.0 1.0 12.0 1.0 "Count"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, size, sizeRange, count

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float size;
uniform float sizeRange;
uniform float count;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float field = 0.0;
  vec3 mixedColor = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (float(i) >= count) break;
    vec2 seed = paperTextureNoise2(vec2(float(i) * 0.17, float(i) * 0.11));
    vec2 pos = 0.55 * vec2(sin(iTime * (0.25 + seed.x) + float(i)), cos(iTime * (0.2 + seed.y) + float(i) * 1.7));
    float r = 0.08 + size * 0.18 * (1.0 - seed.x * sizeRange);
    float v = (r * r) / max(dot(uv - pos, uv - pos), 1e-4);
    field += v;
    mixedColor += paperPalette(int(mod(float(i), 5.0)), colorA, colorB, colorC, colorD, colorE) * v;
  }
  mixedColor /= max(field, 1e-4);
  float mask = smoothstep(0.85, 1.15, field);
  fragColor = vec4(mix(colorBack, mixedColor, mask), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders metaball blobs with a noise texture inlet.',
  data: { code: code.trim() }
};
