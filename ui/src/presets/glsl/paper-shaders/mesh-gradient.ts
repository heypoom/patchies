import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
// @title Paper Mesh Gradient
// @primaryButton settings
// @param colorA color #ff4d8d "Color A"
// @param colorB color #6be4ff "Color B"
// @param colorC color #ffe66d "Color C"
// @param colorD color #7856ff "Color D"
// @param colorE color #1dd1a1 "Color E"
// @param distortion 0.45 0.0 1.0 0.001 "Distortion"
// @param swirl 0.35 0.0 1.0 0.001 "Swirl"
// @param grainMixer 0.15 0.0 1.0 0.001 "Grain Mixer"
// @param grainOverlay 0.12 0.0 1.0 0.001 "Grain Overlay"
// @noinlet colorA, colorB, colorC, colorD, colorE, distortion, swirl, grainMixer, grainOverlay

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float distortion;
uniform float swirl;
uniform float grainMixer;
uniform float grainOverlay;

${mathUtils}
${commonUv}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 getPosition(int i, float t) {
  float a = float(i) * 0.37;
  float b = 0.6 + fract(float(i) / 3.0) * 0.9;
  float c = 0.8 + fract(float(i + 1) / 4.0);
  return 0.5 + 0.5 * vec2(sin(t * b + a), cos(t * c + a * 1.5));
}

vec3 getColor(int i) {
  if (i == 0) return colorA;
  if (i == 1) return colorB;
  if (i == 2) return colorC;
  if (i == 3) return colorD;
  return colorE;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord) + 0.5;
  vec2 grainUV = uv * 1000.0;
  float grain = valueNoise(grainUV);
  float mixerGrain = 0.4 * grainMixer * (grain - 0.5);
  float t = 0.5 * (iTime + 41.5);

  float radius = smoothstep(0.0, 1.0, length(uv - 0.5));
  float center = 1.0 - radius;
  for (float i = 1.0; i <= 2.0; i++) {
    uv.x += distortion * center / i * sin(t + i * 0.4 * smoothstep(0.0, 1.0, uv.y)) * cos(0.2 * t + i * 2.4 * smoothstep(0.0, 1.0, uv.y));
    uv.y += distortion * center / i * cos(t + i * 2.0 * smoothstep(0.0, 1.0, uv.x));
  }

  vec2 uvRotated = uv - 0.5;
  uvRotated = rotate(uvRotated, -3.0 * swirl * radius) + 0.5;

  vec3 color = vec3(0.0);
  float totalWeight = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 pos = getPosition(i, t) + mixerGrain;
    float dist = pow(length(uvRotated - pos), 3.5);
    float weight = 1.0 / (dist + 1e-3);
    color += getColor(i) * weight;
    totalWeight += weight;
  }

  color /= max(1e-4, totalWeight);

  float grainLayer = valueNoise(rotate(grainUV, 1.0) + vec2(3.0));
  grainLayer = mix(grainLayer, valueNoise(rotate(grainUV, 2.0) + vec2(-1.0)), 0.5);
  grainLayer = pow(grainLayer, 1.3);
  float grainValue = grainLayer * 2.0 - 1.0;
  vec3 grainColor = vec3(step(0.0, grainValue));
  float grainStrength = pow(grainOverlay * abs(grainValue), 0.8);
  color = mix(color, grainColor, 0.35 * grainStrength);

  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Animated Paper Shaders mesh gradient with grain and swirl controls.',
  data: { code: code.trim() }
};
