import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
// @title Paper Dithering
// @primaryButton settings
// @param colorBack color #f7efe2 "Background"
// @param colorFront color #151515 "Ink"
// @param shape 2 (1: Simplex, 2: Warp, 3: Dots, 4: Wave, 5: Ripple, 6: Swirl, 7: Sphere) "Shape"
// @param type 4 (1: Random, 2: Bayer 2x2, 3: Bayer 4x4, 4: Bayer 8x8) "Dither Type"
// @param pixelSize 5.0 1.0 28.0 0.1 "Pixel Size"
// @param contrast 0.75 0.0 1.5 0.001 "Contrast"
// @noinlet colorBack, colorFront, shape, type, pixelSize, contrast

uniform vec3 colorBack;
uniform vec3 colorFront;
uniform float shape;
uniform float type;
uniform float pixelSize;
uniform float contrast;

${mathUtils}
${commonUv}

float bayer2(vec2 p) {
  vec2 f = mod(floor(p), 2.0);
  return (f.x + 2.0 * f.y + 0.5) / 4.0;
}

float bayer4(vec2 p) {
  vec2 f = mod(floor(p), 4.0);
  float x = f.x;
  float y = f.y;
  float v = mod(x + 2.0 * y, 4.0);
  v += 4.0 * mod(2.0 * x + y, 4.0);
  return (v + 0.5) / 16.0;
}

float bayer8(vec2 p) {
  vec2 f = mod(floor(p), 8.0);
  float x = f.x;
  float y = f.y;
  float v = mod(x + 2.0 * y, 8.0);
  v += 8.0 * mod(2.0 * x + 4.0 * y, 8.0);
  return (v + 0.5) / 64.0;
}

float ditherThreshold(vec2 p) {
  if (type < 1.5) return hash21(p);
  if (type < 2.5) return bayer2(p);
  if (type < 3.5) return bayer4(p);
  return bayer8(p);
}

float paperDitherShape(vec2 uv) {
  float t = 0.5 * iTime;
  if (shape < 1.5) {
    float n = 0.5 + 0.5 * snoise(uv * 3.0 + vec2(0.0, t));
    n += 0.25 * snoise(uv * 6.0 - vec2(t, 0.0));
    return smoothstep(0.25, 0.95, n);
  }
  if (shape < 2.5) {
    vec2 p = uv * 2.4;
    for (float i = 1.0; i < 6.0; i++) {
      p.x += 0.5 / i * cos(i * 2.5 * p.y + t);
      p.y += 0.5 / i * cos(i * 1.5 * p.x + t);
    }
    return smoothstep(0.02, 0.8, 0.14 / max(0.001, abs(sin(t - p.x - p.y))));
  }
  if (shape < 3.5) {
    vec2 p = uv * 8.0;
    return pow(abs(sin(p.x) * cos(p.y - 1.7 * t)), 5.0);
  }
  if (shape < 4.5) {
    vec2 p = uv * vec2(4.0, 3.0);
    float wave = cos(0.5 * p.x - 2.0 * t) * sin(1.5 * p.x + t);
    return 1.0 - smoothstep(-0.7, 0.7, p.y + wave);
  }
  if (shape < 5.5) {
    float d = length(uv);
    return 0.5 + 0.5 * sin(pow(d, 1.7) * 16.0 - 3.0 * t);
  }
  if (shape < 6.5) {
    float l = length(uv);
    float a = 6.0 * atan(uv.y, uv.x) + 4.0 * t;
    float twist = 1.2;
    float offset = 1.0 / pow(max(l, 1e-6), twist) + a / TWO_PI;
    return mix(0.0, fract(offset), smoothstep(0.0, 1.0, pow(l, twist)));
  }

  vec2 p = uv * 2.0;
  float d = 1.0 - dot(p, p);
  vec3 pos = vec3(p, sqrt(max(0.0, d)));
  vec3 lightPos = normalize(vec3(cos(1.5 * t), 0.8, sin(1.25 * t)));
  return (0.5 + 0.5 * dot(lightPos, pos)) * step(0.0, d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  vec2 pixel = floor(fragCoord / max(pixelSize, 1.0));
  float value = paperDitherShape(uv);
  value = clamp((value - 0.5) * (1.0 + contrast) + 0.5, 0.0, 1.0);
  float ink = step(ditherThreshold(pixel), value);
  fragColor = vec4(mix(colorBack, colorFront, ink), 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders dithering patterns with random and Bayer threshold modes.',
  data: { code: code.trim() }
};
