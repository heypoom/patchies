import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils, paletteHelpers } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Static Paper Shaders radial gradient with focal and distortion controls.',
  data: { code: code.trim() }
};
