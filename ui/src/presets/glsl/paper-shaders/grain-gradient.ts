import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers, noiseTextureHelpers } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Grainy Paper Shaders gradient with a noise texture inlet.',
  data: { code: code.trim() }
};
