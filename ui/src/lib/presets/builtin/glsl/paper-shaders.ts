import type { GLSLPreset } from './types';

export const PAPER_SHADER_PRESET_NAMES = [
  'Paper Mesh Gradient',
  'Paper Dot Grid',
  'Paper Waves',
  'Paper Spiral'
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
    }
  };
