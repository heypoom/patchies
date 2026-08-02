import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Static Paper Shaders mesh gradient with wave and grain controls.',
  data: { code: code.trim() }
};
