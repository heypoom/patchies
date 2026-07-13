import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
// @title Paper Texture
// @primaryButton settings
// @param colorBack color #d9c7aa "Background"
// @param colorFront color #fff7e6 "Surface"
// @param contrast 0.65 0.0 1.0 0.001 "Contrast"
// @param roughness 0.55 0.0 1.0 0.001 "Roughness"
// @param fiber 0.45 0.0 1.0 0.001 "Fiber"
// @param fiberSize 0.45 0.05 1.0 0.001 "Fiber Size"
// @param crumples 0.35 0.0 1.0 0.001 "Crumples"
// @param crumpleSize 0.45 0.05 1.0 0.001 "Crumple Size"
// @param folds 0.35 0.0 1.0 0.001 "Folds"
// @param foldCount 8.0 1.0 15.0 1.0 "Fold Count"
// @param drops 0.18 0.0 1.0 0.001 "Drops"
// @param fade 0.15 0.0 1.0 0.001 "Fade"
// @param seed 9.0 0.0 100.0 0.1 "Seed"
// @noinlet colorBack, colorFront, contrast, roughness, fiber, fiberSize, crumples, crumpleSize, folds, foldCount, drops, fade, seed

uniform vec3 colorBack;
uniform vec3 colorFront;
uniform float contrast;
uniform float roughness;
uniform float fiber;
uniform float fiberSize;
uniform float crumples;
uniform float crumpleSize;
uniform float folds;
uniform float foldCount;
uniform float drops;
uniform float fade;
uniform float seed;

${mathUtils}
${commonUv}
${noiseTextureHelpers}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = paperTextureNoise(i * 0.013 + seed);
  float b = paperTextureNoise((i + vec2(1.0, 0.0)) * 0.013 + seed);
  float c = paperTextureNoise((i + vec2(0.0, 1.0)) * 0.013 + seed);
  float d = paperTextureNoise((i + vec2(1.0, 1.0)) * 0.013 + seed);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float total = 0.0;
  float amp = 0.45;

  for (int i = 0; i < 5; i++) {
    total += valueNoise(p) * amp;
    p *= 2.05;
    amp *= 0.55;
  }

  return total;
}

float foldField(vec2 uv) {
  float result = 0.0;

  for (int i = 0; i < 15; i++) {
    float fi = float(i);
    if (fi >= foldCount) break;
    vec2 rand = paperTextureNoise2(vec2(fi, fi * seed));
    float an = rand.x * TWO_PI;
    vec2 n = vec2(cos(an), sin(an));
    float d = abs(dot(uv, n) - (rand.y - 0.5) * 2.0);
    result += exp(-18.0 * d) * (0.5 + 0.5 * sin(uv.x * 12.0 + fi + seed));
  }

  return result / max(foldCount, 1.0);
}

float dropsField(vec2 uv) {
  vec2 cell = floor(uv);
  vec2 f = fract(uv);
  float nearest = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 offset = paperTextureNoise2((cell + neighbor) * 0.07 + seed);
      vec2 p = neighbor + offset - f;
      nearest = min(nearest, length(p));
    }
  }
  return 1.0 - smoothstep(0.04, 0.11, nearest);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  vec2 patternUV = uv * vec2(iResolution.x / max(iResolution.y, 1.0), 1.0) * 4.0;
  float bigFade = fade * fbm(patternUV * 0.18 + seed);
  bigFade = clamp(6.0 * bigFade * bigFade, 0.0, 1.0);

  float rough = fbm(fragCoord * 0.55 + seed * 10.0) - 0.5;
  float fibers = snoise(patternUV * (10.0 / fiberSize) + vec2(seed, -seed));
  float crumple = fbm(fract(patternUV * 0.12 / crumpleSize - seed) * 32.0);
  float fold = foldField(rotate(patternUV * 0.25, seed));
  float speckles = dropsField(patternUV * 8.0 + seed);

  float height = 0.0;
  height += roughness * rough;
  height += 0.35 * fiber * fibers;
  height += crumples * (crumple - 0.5);
  height += folds * fold;
  height += drops * speckles;
  height *= mix(1.0, 0.45, bigFade);

  vec3 light = normalize(vec3(0.8, 1.6, 1.0));
  vec2 e = vec2(0.002, 0.0);
  float hx = fbm((patternUV + e.xy) * 2.0) - fbm((patternUV - e.xy) * 2.0);
  float hy = fbm((patternUV + e.yx) * 2.0) - fbm((patternUV - e.yx) * 2.0);
  float shade = dot(normalize(vec3(hx + height * 0.2, hy + height * 0.2, 0.55)), light);
  shade = 0.65 + 0.35 * shade;

  float paper = clamp(0.5 + contrast * height, 0.0, 1.0);
  vec3 color = mix(colorBack, colorFront, paper) * shade;
  color -= 0.06 * drops * speckles;
  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders paper/cardboard texture with a noise texture inlet.',
  data: { code: code.trim() }
};
