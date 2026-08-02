import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Layered Paper Shaders translucent color panel pattern.',
  data: { code: code.trim() }
};
