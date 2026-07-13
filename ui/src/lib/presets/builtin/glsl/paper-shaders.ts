import type { GLSLPreset } from './types';

export const PAPER_SHADER_PRESET_NAMES = [
  'Paper Mesh Gradient',
  'Paper Dot Grid',
  'Paper Waves',
  'Paper Spiral',
  'Paper Static Mesh Gradient',
  'Paper Static Radial Gradient',
  'Paper Simplex Noise',
  'Paper Perlin Noise',
  'Paper Neuro Noise',
  'Paper Swirl',
  'Paper Color Panels',
  'Paper Dot Orbit',
  'Paper Metaballs',
  'Paper Voronoi',
  'Paper Warp',
  'Paper God Rays',
  'Paper Grain Gradient',
  'Paper Smoke Ring',
  'Paper Pulsing Border'
] as const;

const sourceNotice = `// Ported from @paper-design/shaders (Apache-2.0)
// NOTICE: Paper Shaders, Copyright 2026 Paper
// https://shaders.paper.design`;

const commonUv = `
vec2 paperPatternUV(vec2 fragCoord) {
  return (fragCoord - 0.5 * iResolution.xy) * 0.01;
}

vec2 paperObjectUV(vec2 fragCoord) {
  float boxSize = max(min(iResolution.x, iResolution.y), 1.0);
  return (fragCoord - 0.5 * iResolution.xy) / boxSize;
}
`;

const mathUtils = `
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

const meshGradientCode = `${sourceNotice}
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

const dotGridCode = `${sourceNotice}
// @title Paper Dot Grid
// @primaryButton settings
// @param colorBack color #111111 "Background"
// @param colorFill color #f8f4e3 "Fill"
// @param colorStroke color #ff4d8d "Stroke"
// @param dotSize 42.0 1.0 120.0 0.1 "Dot Size"
// @param gapX 96.0 2.0 260.0 0.1 "Gap X"
// @param gapY 96.0 2.0 260.0 0.1 "Gap Y"
// @param strokeWidth 4.0 0.0 50.0 0.1 "Stroke Width"
// @param sizeRange 0.3 0.0 1.0 0.001 "Size Range"
// @param opacityRange 0.1 0.0 1.0 0.001 "Opacity Range"
// @param shape 0 (0: Circle, 1: Diamond, 2: Square, 3: Triangle) "Shape"
// @noinlet colorBack, colorFill, colorStroke, dotSize, gapX, gapY, strokeWidth, sizeRange, opacityRange, shape

uniform vec3 colorBack;
uniform vec3 colorFill;
uniform vec3 colorStroke;
uniform float dotSize;
uniform float gapX;
uniform float gapY;
uniform float strokeWidth;
uniform float sizeRange;
uniform float opacityRange;
uniform float shape;

${mathUtils}
${commonUv}

float polygon(vec2 p, float N, float rot) {
  float a = atan(p.x, p.y) + rot;
  float r = TWO_PI / N;
  return cos(floor(0.5 + a / r) * r - a) * length(p);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 shapeUv = paperPatternUV(fragCoord) * 100.0;
  vec2 gap = max(abs(vec2(gapX, gapY)), vec2(1e-6));
  vec2 grid = fract(shapeUv / gap) + 1e-4;
  vec2 gridIdx = floor(shapeUv / gap);
  float sizeRandomizer = 0.5 + 0.8 * snoise(2.0 * vec2(gridIdx.x * 100.0, gridIdx.y));
  float opacityRandomizer = 0.5 + 0.7 * snoise(2.0 * vec2(gridIdx.y, gridIdx.x));
  vec2 p = (grid - vec2(0.5) + 1e-3) * gap;

  float baseSize = dotSize * (1.0 - sizeRandomizer * sizeRange);
  float width = strokeWidth * (1.0 - sizeRandomizer * sizeRange);
  float dist;

  if (shape < 0.5) {
    dist = length(p);
  } else if (shape < 1.5) {
    width *= 1.5;
    dist = polygon(1.5 * p, 4.0, 0.25 * PI);
  } else if (shape < 2.5) {
    dist = polygon(1.03 * p, 4.0, 1e-3);
  } else {
    width *= 1.5;
    p = p * 2.0 - 1.0;
    p *= 0.9;
    p.y = 1.0 - p.y - 0.75 * baseSize;
    dist = polygon(p, 3.0, 1e-3);
  }

  float edgeWidth = fwidth(dist);
  float outer = 1.0 - smoothstep(baseSize - edgeWidth, baseSize + edgeWidth, dist - width);
  float inner = 1.0 - smoothstep(baseSize - edgeWidth, baseSize + edgeWidth, dist);
  float stroke = outer - inner;
  float dotOpacity = max(0.0, 1.0 - opacityRandomizer * opacityRange);

  stroke *= dotOpacity;
  inner *= dotOpacity;

  vec3 color = mix(colorBack, colorStroke, stroke);
  color = mix(color, colorFill, inner);
  fragColor = vec4(color, 1.0);
}`;

const wavesCode = `${sourceNotice}
// @title Paper Waves
// @primaryButton settings
// @param colorFront color #f8f4e3 "Foreground"
// @param colorBack color #102a43 "Background"
// @param shape 1.2 0.0 3.0 0.001 "Shape"
// @param frequency 1.4 0.0 3.0 0.001 "Frequency"
// @param amplitude 0.35 0.0 1.0 0.001 "Amplitude"
// @param spacing 0.45 0.01 2.0 0.001 "Spacing"
// @param proportion 0.48 0.0 1.0 0.001 "Proportion"
// @param softness 0.06 0.0 1.0 0.001 "Softness"
// @noinlet colorFront, colorBack, shape, frequency, amplitude, spacing, proportion, softness

uniform vec3 colorFront;
uniform vec3 colorBack;
uniform float shape;
uniform float frequency;
uniform float amplitude;
uniform float spacing;
uniform float proportion;
uniform float softness;

${mathUtils}
${commonUv}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 shapeUv = paperPatternUV(fragCoord) * 4.0;

  float wave = 0.5 * cos(shapeUv.x * frequency * TWO_PI);
  float zigzag = 2.0 * abs(fract(shapeUv.x * frequency) - 0.5);
  float irregular = sin(shapeUv.x * 0.25 * frequency * TWO_PI) * cos(shapeUv.x * frequency * TWO_PI);
  float irregular2 = 0.75 * (sin(shapeUv.x * frequency * TWO_PI) + 0.5 * cos(shapeUv.x * 0.5 * frequency * TWO_PI));

  float offset = mix(zigzag, wave, smoothstep(0.0, 1.0, shape));
  offset = mix(offset, irregular, smoothstep(1.0, 2.0, shape));
  offset = mix(offset, irregular2, smoothstep(2.0, 3.0, shape));
  offset *= 2.0 * amplitude;

  float waveShape = 0.5 + 0.5 * sin((shapeUv.y + offset) * PI / (0.001 + spacing));
  float aa = 0.0001 + fwidth(waveShape);
  float center = 1.0 - clamp(proportion, 0.0, 1.0);
  float res = smoothstep(center - softness - aa, center + softness + aa, waveShape);

  fragColor = vec4(mix(colorBack, colorFront, res), 1.0);
}`;

const spiralCode = `${sourceNotice}
// @title Paper Spiral
// @primaryButton settings
// @param colorBack color #0f1020 "Background"
// @param colorFront color #f6d365 "Foreground"
// @param density 0.55 0.0 1.0 0.001 "Density"
// @param distortion 0.35 0.0 1.0 0.001 "Distortion"
// @param strokeWidth 0.42 0.01 1.0 0.001 "Stroke Width"
// @param strokeCap 0.2 0.0 1.0 0.001 "Stroke Cap"
// @param strokeTaper 0.4 0.0 1.0 0.001 "Stroke Taper"
// @param noise 0.24 0.0 1.0 0.001 "Noise"
// @param noiseFrequency 0.45 0.0 1.0 0.001 "Noise Frequency"
// @param softness 0.02 0.0 1.0 0.001 "Softness"
// @noinlet colorBack, colorFront, density, distortion, strokeWidth, strokeCap, strokeTaper, noise, noiseFrequency, softness

uniform vec3 colorBack;
uniform vec3 colorFront;
uniform float density;
uniform float distortion;
uniform float strokeWidth;
uniform float strokeCap;
uniform float strokeTaper;
uniform float noise;
uniform float noiseFrequency;
uniform float softness;

${mathUtils}
${commonUv}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = 2.0 * paperPatternUV(fragCoord);
  float t = iTime;
  float l = pow(max(length(uv), 1e-6), clamp(density, 0.0, 1.0));
  float angle = atan(uv.y, uv.x) - t;
  float angleNormalised = angle / TWO_PI;
  angleNormalised += 0.125 * noise * snoise(16.0 * pow(noiseFrequency, 3.0) * uv);

  float offset = l + angleNormalised;
  offset -= distortion * (sin(4.0 * l - 0.5 * t) * cos(PI + l + 0.5 * t));
  float stripe = fract(offset);
  float shape = 2.0 * abs(stripe - 0.5);
  float width = 1.0 - clamp(strokeWidth, 0.005 * strokeTaper, 1.0);

  float cappedWidth = mix(width, (1.0 - stripe) * (1.0 - step(0.5, stripe)), 1.0 - clamp(length(uv), 0.0, 1.0));
  width = mix(width, cappedWidth, strokeCap);
  width *= 1.0 - clamp(strokeTaper, 0.0, 1.0) * length(uv);

  float fw = fwidth(offset);
  float fwMult = 4.0 - 3.0 * (smoothstep(0.05, 0.4, 2.0 * strokeWidth) * smoothstep(0.05, 0.4, 2.0 * (1.0 - strokeWidth)));
  float pixelSize = mix(fwMult * fw, fwidth(shape), clamp(fw, 0.0, 1.0));
  pixelSize = mix(pixelSize, 0.002, strokeCap * (1.0 - clamp(length(uv), 0.0, 1.0)));
  float res = smoothstep(width - pixelSize - softness, width + pixelSize + softness, shape);

  vec3 color = mix(colorBack, colorFront, res);
  color += 1.0 / 256.0 * (fract(sin(dot(0.014 * gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
  fragColor = vec4(color, 1.0);
}`;

const paletteHelpers = `
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

const noiseTextureHelpers = `
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

const staticMeshGradientCode = `${sourceNotice}
// @title Mesh Gradient
// @primaryButton settings
// @param colorA color #f72585 "Color A"
// @param colorB color #7209b7 "Color B"
// @param colorC color #3a0ca3 "Color C"
// @param colorD color #4cc9f0 "Color D"
// @param colorE color #f9c74f "Color E"
// @param positions 0.45 0.0 1.0 0.001 "Positions"
// @param waveX 0.25 0.0 1.0 0.001 "Wave X"
// @param waveY 0.35 0.0 1.0 0.001 "Wave Y"
// @param mixing 0.85 0.0 1.0 0.001 "Mixing"
// @param grainOverlay 0.12 0.0 1.0 0.001 "Grain"
// @noinlet colorA, colorB, colorC, colorD, colorE, positions, waveX, waveY, mixing, grainOverlay

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float positions;
uniform float waveX;
uniform float waveY;
uniform float mixing;
uniform float grainOverlay;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord) + 0.5;
  vec3 color = vec3(0.0);
  float total = 0.0;

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 pos = vec2(fract(0.17 + fi * 0.31 + positions), fract(0.83 + fi * 0.23 - positions));
    pos.x += waveX * 0.16 * sin(uv.y * TWO_PI * (1.0 + fi * 0.2) + fi);
    pos.y += waveY * 0.16 * cos(uv.x * TWO_PI * (1.0 + fi * 0.25) + fi * 1.7);
    float dist = pow(length(uv - pos), mix(1.2, 3.2, mixing));
    float weight = 1.0 / (dist + 0.02);
    color += paperPalette(i, colorA, colorB, colorC, colorD, colorE) * weight;
    total += weight;
  }

  color /= max(total, 1e-4);
  float grain = hash21(gl_FragCoord.xy) * 2.0 - 1.0;
  color += grain * grainOverlay * 0.08;
  fragColor = vec4(color, 1.0);
}`;

const staticRadialGradientCode = `${sourceNotice}
// @title Radial Gradient
// @primaryButton settings
// @param colorBack color #09090b "Background"
// @param colorA color #ff006e "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ffbe0b "Color C"
// @param colorD color #3a86ff "Color D"
// @param colorE color #8338ec "Color E"
// @param radius 0.85 0.05 2.0 0.001 "Radius"
// @param focalDistance 0.25 0.0 1.0 0.001 "Focal Distance"
// @param focalAngle 0.18 0.0 1.0 0.001 "Focal Angle"
// @param falloff 0.7 0.0 2.0 0.001 "Falloff"
// @param distortion 0.15 0.0 1.0 0.001 "Distortion"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, radius, focalDistance, focalAngle, falloff, distortion

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float radius;
uniform float focalDistance;
uniform float focalAngle;
uniform float falloff;
uniform float distortion;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float angle = focalAngle * TWO_PI;
  vec2 focal = focalDistance * vec2(cos(angle), sin(angle));
  float n = snoise(uv * 3.0 + distortion * 2.0);
  float d = length(uv - focal + distortion * 0.15 * vec2(n, snoise(uv.yx * 3.0)));
  float t = pow(smoothstep(radius, 0.0, d), max(0.05, falloff));
  vec3 color = mix(colorBack, paperGradient(t, colorA, colorB, colorC, colorD, colorE), t);
  fragColor = vec4(color, 1.0);
}`;

const simplexNoiseCode = `${sourceNotice}
// @title Paper Simplex Noise
// @primaryButton settings
// @param colorA color #10002b "Color A"
// @param colorB color #240046 "Color B"
// @param colorC color #5a189a "Color C"
// @param colorD color #c77dff "Color D"
// @param colorE color #e0aaff "Color E"
// @param scale 1.8 0.1 8.0 0.001 "Scale"
// @param stepsPerColor 1.0 0.1 5.0 0.001 "Steps Per Color"
// @param softness 0.35 0.0 1.0 0.001 "Softness"
// @noinlet colorA, colorB, colorC, colorD, colorE, scale, stepsPerColor, softness

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float scale;
uniform float stepsPerColor;
uniform float softness;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * scale;
  float n = 0.5 + 0.5 * snoise(uv + vec2(0.12 * iTime, -0.08 * iTime));
  float bands = max(1.0, stepsPerColor * 5.0);
  float stepped = floor(n * bands) / bands;
  n = mix(stepped, n, softness);
  fragColor = vec4(paperGradient(n, colorA, colorB, colorC, colorD, colorE), 1.0);
}`;

const perlinNoiseCode = `${sourceNotice}
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

const neuroNoiseCode = `${sourceNotice}
// @title Paper Neuro Noise
// @primaryButton settings
// @param colorFront color #e0fbfc "Front"
// @param colorMid color #3d5a80 "Mid"
// @param colorBack color #0b132b "Back"
// @param brightness 0.75 0.0 2.0 0.001 "Brightness"
// @param contrast 1.2 0.1 4.0 0.001 "Contrast"
// @noinlet colorFront, colorMid, colorBack, brightness, contrast

uniform vec3 colorFront;
uniform vec3 colorMid;
uniform vec3 colorBack;
uniform float brightness;
uniform float contrast;

${mathUtils}
${commonUv}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * 1.6;
  float t = 0.5 * iTime;
  float field = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i) + 1.0;
    vec2 p = uv + 0.25 * vec2(sin(t * 0.7 + fi), cos(t * 0.5 + fi * 1.7));
    field += abs(0.04 / (sin(p.x * fi + t) + cos(p.y * (fi + 0.7) - t) + 0.08));
  }
  field = pow(clamp(field * brightness, 0.0, 1.0), contrast);
  vec3 color = mix(colorBack, colorMid, smoothstep(0.05, 0.55, field));
  color = mix(color, colorFront, smoothstep(0.55, 1.0, field));
  fragColor = vec4(color, 1.0);
}`;

const swirlCode = `${sourceNotice}
// @title Paper Swirl
// @primaryButton settings
// @param colorA color #03045e "Color A"
// @param colorB color #0077b6 "Color B"
// @param colorC color #00b4d8 "Color C"
// @param colorD color #90e0ef "Color D"
// @param colorE color #caf0f8 "Color E"
// @param bandCount 5.0 1.0 16.0 0.001 "Bands"
// @param twist 0.9 0.0 2.0 0.001 "Twist"
// @param center 0.35 0.0 1.0 0.001 "Center"
// @param softness 0.35 0.0 1.0 0.001 "Softness"
// @param noise 0.15 0.0 1.0 0.001 "Noise"
// @noinlet colorA, colorB, colorC, colorD, colorE, bandCount, twist, center, softness, noise

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float bandCount;
uniform float twist;
uniform float center;
uniform float softness;
uniform float noise;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float n = noise * snoise(uv * 5.0 + 0.1 * iTime);
  float v = fract((a / TWO_PI) * bandCount + twist * pow(r + center, 0.7) - 0.08 * iTime + n);
  v = mix(floor(v * 5.0) / 5.0, v, softness);
  fragColor = vec4(paperGradient(v, colorA, colorB, colorC, colorD, colorE), 1.0);
}`;

const colorPanelsCode = `${sourceNotice}
// @title Paper Color Panels
// @primaryButton settings
// @param colorBack color #06070a "Background"
// @param colorA color #ff4d6d "Color A"
// @param colorB color #ffd166 "Color B"
// @param colorC color #06d6a0 "Color C"
// @param colorD color #118ab2 "Color D"
// @param colorE color #8338ec "Color E"
// @param density 5.0 1.0 16.0 0.001 "Density"
// @param angle1 0.15 0.0 1.0 0.001 "Angle 1"
// @param angle2 0.55 0.0 1.0 0.001 "Angle 2"
// @param blur 0.12 0.0 1.0 0.001 "Blur"
// @param gradient 0.35 0.0 1.0 0.001 "Gradient"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, density, angle1, angle2, blur, gradient

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float density;
uniform float angle1;
uniform float angle2;
uniform float blur;
uniform float gradient;

${mathUtils}
${commonUv}
${paletteHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float t = 0.02 * iTime;
  vec2 p1 = rotate(uv, angle1 * TWO_PI + t);
  vec2 p2 = rotate(uv, angle2 * TWO_PI - t * 1.4);
  float panel = fract((p1.x + p2.y) * density);
  float mask = smoothstep(0.08 + blur, 0.08 - blur, abs(panel - 0.5) - 0.25);
  float g = fract(panel + gradient * length(uv));
  vec3 color = mix(colorBack, paperGradient(g, colorA, colorB, colorC, colorD, colorE), mask);
  fragColor = vec4(color, 1.0);
}`;

const dotOrbitCode = `${sourceNotice}
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

const metaballsCode = `${sourceNotice}
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

const voronoiCode = `${sourceNotice}
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

const warpCode = `${sourceNotice}
// @title Paper Warp
// @primaryButton settings
// @param colorA color #ffbe0b "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ff006e "Color C"
// @param colorD color #8338ec "Color D"
// @param colorE color #3a86ff "Color E"
// @param scale 1.3 0.2 6.0 0.001 "Scale"
// @param softness 0.45 0.0 1.0 0.001 "Softness"
// @param shape 0.4 0.0 1.0 0.001 "Shape"
// @param distortion 0.45 0.0 1.0 0.001 "Distortion"
// @param swirl 0.35 0.0 1.0 0.001 "Swirl"
// @noinlet colorA, colorB, colorC, colorD, colorE, scale, softness, shape, distortion, swirl

uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float scale;
uniform float softness;
uniform float shape;
uniform float distortion;
uniform float swirl;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord) * scale;
  float r = length(uv);
  uv = rotate(uv, swirl * r * 4.0);
  vec2 n = vec2(paperTextureNoise(uv * 0.13 + iTime * 0.02), paperTextureNoise(uv.yx * 0.13 - iTime * 0.015));
  uv += distortion * (n - 0.5) * 2.0;
  float stripes = 0.5 + 0.5 * sin(uv.x * PI + shape * sin(uv.y * TWO_PI));
  float smoke = 0.5 + 0.5 * snoise(uv * 2.0 + 0.05 * iTime);
  float v = mix(stripes, smoke, softness);
  fragColor = vec4(paperGradient(v, colorA, colorB, colorC, colorD, colorE), 1.0);
}`;

const godRaysCode = `${sourceNotice}
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

const grainGradientCode = `${sourceNotice}
// @title Paper Grain Gradient
// @primaryButton settings
// @param colorBack color #111111 "Background"
// @param colorA color #f94144 "Color A"
// @param colorB color #f3722c "Color B"
// @param colorC color #f9c74f "Color C"
// @param colorD color #43aa8b "Color D"
// @param colorE color #577590 "Color E"
// @param softness 0.4 0.0 1.0 0.001 "Softness"
// @param intensity 0.85 0.0 2.0 0.001 "Intensity"
// @param grain 0.35 0.0 1.0 0.001 "Grain"
// @param shape 0.45 0.0 1.0 0.001 "Shape"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, softness, intensity, grain, shape

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float softness;
uniform float intensity;
uniform float grain;
uniform float shape;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperPatternUV(fragCoord);
  float n = 0.5 + 0.5 * snoise(uv * mix(1.0, 4.0, shape) + 0.08 * iTime);
  float g = paperTextureNoise(gl_FragCoord.xy / max(iResolution.xy, vec2(1.0)));
  float v = mix(floor(n * 6.0) / 6.0, n, softness);
  vec3 color = mix(colorBack, paperGradient(v, colorA, colorB, colorC, colorD, colorE), intensity);
  color += (g - 0.5) * grain * 0.28;
  fragColor = vec4(color, 1.0);
}`;

const smokeRingCode = `${sourceNotice}
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

const pulsingBorderCode = `${sourceNotice}
// @title Paper Pulsing Border
// @primaryButton settings
// @param colorBack color #050505 "Background"
// @param colorA color #ff006e "Color A"
// @param colorB color #fb5607 "Color B"
// @param colorC color #ffbe0b "Color C"
// @param colorD color #3a86ff "Color D"
// @param colorE color #8338ec "Color E"
// @param roundness 0.25 0.0 1.0 0.001 "Roundness"
// @param thickness 0.08 0.01 0.4 0.001 "Thickness"
// @param softness 0.08 0.0 0.4 0.001 "Softness"
// @param intensity 0.9 0.0 2.0 0.001 "Intensity"
// @param pulse 0.5 0.0 1.0 0.001 "Pulse"
// @param smoke 0.25 0.0 1.0 0.001 "Smoke"
// @noinlet colorBack, colorA, colorB, colorC, colorD, colorE, roundness, thickness, softness, intensity, pulse, smoke

uniform vec3 colorBack;
uniform vec3 colorA;
uniform vec3 colorB;
uniform vec3 colorC;
uniform vec3 colorD;
uniform vec3 colorE;
uniform float roundness;
uniform float thickness;
uniform float softness;
uniform float intensity;
uniform float pulse;
uniform float smoke;

${mathUtils}
${commonUv}
${paletteHelpers}
${noiseTextureHelpers}

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = paperObjectUV(fragCoord);
  float beat = 0.5 + 0.5 * sin(iTime * 2.4);
  float noisy = smoke * (paperTextureNoise(uv * 1.5 + iTime * 0.02) - 0.5);
  float d = roundedBox(uv + noisy * 0.04, vec2(0.44), roundness * 0.2);
  float border = smoothstep(thickness + softness, thickness - softness, abs(d));
  float glow = exp(-12.0 * abs(d)) * (0.35 + pulse * beat);
  vec3 color = paperGradient(fract(atan(uv.y, uv.x) / TWO_PI + iTime * 0.03), colorA, colorB, colorC, colorD, colorE);
  float amount = clamp(border * intensity + glow * 0.35, 0.0, 1.0);
  fragColor = vec4(mix(colorBack, color, amount), 1.0);
}`;

export const PAPER_SHADER_PRESETS: Record<(typeof PAPER_SHADER_PRESET_NAMES)[number], GLSLPreset> =
  {
    'Paper Mesh Gradient': {
      type: 'glsl',
      description: 'Animated Paper Shaders mesh gradient with grain and swirl controls.',
      data: { code: meshGradientCode.trim() }
    },
    'Paper Dot Grid': {
      type: 'glsl',
      description: 'Paper Shaders dot-grid pattern with selectable dot shapes.',
      data: { code: dotGridCode.trim() }
    },
    'Paper Waves': {
      type: 'glsl',
      description: 'Paper Shaders line pattern that morphs from zigzags into soft waves.',
      data: { code: wavesCode.trim() }
    },
    'Paper Spiral': {
      type: 'glsl',
      description: 'Animated Paper Shaders spiral with distortion, taper, and noise controls.',
      data: { code: spiralCode.trim() }
    },
    'Paper Static Mesh Gradient': {
      type: 'glsl',
      description: 'Static Paper Shaders mesh gradient with wave and grain controls.',
      data: { code: staticMeshGradientCode.trim() }
    },
    'Paper Static Radial Gradient': {
      type: 'glsl',
      description: 'Static Paper Shaders radial gradient with focal and distortion controls.',
      data: { code: staticRadialGradientCode.trim() }
    },
    'Paper Simplex Noise': {
      type: 'glsl',
      description: 'Animated Paper Shaders simplex noise color field.',
      data: { code: simplexNoiseCode.trim() }
    },
    'Paper Perlin Noise': {
      type: 'glsl',
      description: 'Animated Paper Shaders layered value-noise texture.',
      data: { code: perlinNoiseCode.trim() }
    },
    'Paper Neuro Noise': {
      type: 'glsl',
      description: 'Glowing Paper Shaders neuro-noise line field.',
      data: { code: neuroNoiseCode.trim() }
    },
    'Paper Swirl': {
      type: 'glsl',
      description: 'Animated Paper Shaders swirl bands with noise controls.',
      data: { code: swirlCode.trim() }
    },
    'Paper Color Panels': {
      type: 'glsl',
      description: 'Layered Paper Shaders translucent color panel pattern.',
      data: { code: colorPanelsCode.trim() }
    },
    'Paper Dot Orbit': {
      type: 'glsl',
      description: 'Animated Paper Shaders orbiting dot grid with a noise texture inlet.',
      data: { code: dotOrbitCode.trim() }
    },
    'Paper Metaballs': {
      type: 'glsl',
      description: 'Paper Shaders metaball blobs with a noise texture inlet.',
      data: { code: metaballsCode.trim() }
    },
    'Paper Voronoi': {
      type: 'glsl',
      description: 'Animated Paper Shaders Voronoi cells with a noise texture inlet.',
      data: { code: voronoiCode.trim() }
    },
    'Paper Warp': {
      type: 'glsl',
      description: 'Warped Paper Shaders color field with a noise texture inlet.',
      data: { code: warpCode.trim() }
    },
    'Paper God Rays': {
      type: 'glsl',
      description: 'Paper Shaders radial light rays with a noise texture inlet.',
      data: { code: godRaysCode.trim() }
    },
    'Paper Grain Gradient': {
      type: 'glsl',
      description: 'Grainy Paper Shaders gradient with a noise texture inlet.',
      data: { code: grainGradientCode.trim() }
    },
    'Paper Smoke Ring': {
      type: 'glsl',
      description: 'Paper Shaders smoky radial ring with a noise texture inlet.',
      data: { code: smokeRingCode.trim() }
    },
    'Paper Pulsing Border': {
      type: 'glsl',
      description: 'Paper Shaders pulsing border with a noise texture inlet.',
      data: { code: pulsingBorderCode.trim() }
    }
  };
