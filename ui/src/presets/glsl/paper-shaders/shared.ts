export const sourceNotice = `// Ported from @paper-design/shaders (Apache-2.0)
// NOTICE: Paper Shaders, Copyright 2026 Paper
// https://shaders.paper.design`;

export const commonUv = `
vec2 paperPatternUV(vec2 fragCoord) {
  return (fragCoord - 0.5 * iResolution.xy) * 0.01;
}

vec2 paperObjectUV(vec2 fragCoord) {
  float boxSize = max(min(iResolution.x, iResolution.y), 1.0);
  return (fragCoord - 0.5 * iResolution.xy) / boxSize;
}
`;

export const mathUtils = `
#define PI 3.14159265358979323846
#define TWO_PI 6.28318530718

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

export const paletteHelpers = `
vec3 paperPalette(int i, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e) {
  if (i == 0) return a;
  if (i == 1) return b;
  if (i == 2) return c;
  if (i == 3) return d;
  return e;
}

vec3 paperGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  if (t < 1.0) return mix(a, b, t);
  if (t < 2.0) return mix(b, c, t - 1.0);
  if (t < 3.0) return mix(c, d, t - 2.0);
  return mix(d, e, t - 3.0);
}
`;

export const noiseTextureHelpers = `
uniform sampler2D noiseTexture;

float paperTextureNoise(vec2 p) {
  float procedural = hash21(floor(p * 127.0));
  float patched = texture(noiseTexture, fract(p)).r;
  return mix(procedural, patched, 0.65);
}

vec2 paperTextureNoise2(vec2 p) {
  vec2 procedural = vec2(hash21(floor(p * 127.0)), hash21(floor(p * 127.0) + 17.0));
  vec2 patched = texture(noiseTexture, fract(p)).gb;
  return mix(procedural, patched, 0.65);
}
`;
