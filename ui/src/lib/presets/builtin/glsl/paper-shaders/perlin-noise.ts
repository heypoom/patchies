import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
// @title Paper Perlin Noise
// @primaryButton settings
// @param colorFront color #f8f4e3 "Foreground"
// @param colorBack color #111111 "Background"
// @param proportion 0.5 0.0 1.0 0.001 "Proportion"
// @param softness 0.2 0.0 1.0 0.001 "Softness"
// @param octaveCount 4.0 1.0 8.0 1.0 "Octaves"
// @param persistence 0.55 0.1 1.0 0.001 "Persistence"
// @param lacunarity 2.0 1.0 4.0 0.001 "Lacunarity"
// @noinlet colorFront, colorBack, proportion, softness, octaveCount, persistence, lacunarity

uniform vec3 colorFront;
uniform vec3 colorBack;
uniform float proportion;
uniform float softness;
uniform float octaveCount;
uniform float persistence;
uniform float lacunarity;

${mathUtils}
${commonUv}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * 2.0 + vec2(0.07 * iTime, -0.04 * iTime);
  float amp = 0.5;
  float freq = 1.0;
  float n = 0.0;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= octaveCount) break;
    n += amp * valueNoise(uv * freq);
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  n /= max(norm, 1e-4);
  float mask = smoothstep(proportion - softness, proportion + softness, n);
  fragColor = vec4(mix(colorBack, colorFront, mask), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders layered value-noise texture.',
  data: { code: code.trim() }
};
