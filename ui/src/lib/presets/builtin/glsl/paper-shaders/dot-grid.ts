import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders dot-grid pattern with selectable dot shapes.',
  data: { code: code.trim() }
};
