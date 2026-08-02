import type { GLSLPreset } from './types';

const code = `// @title Tone Map
// @primaryButton settings
// @param exposure 1.0 0.0 8.0 0.001 "Exposure"
// @param gamma 2.2 0.1 4.0 0.001 "Gamma"
// @param whitePoint 1.0 0.1 16.0 0.001 "White Point"
// @param curve 0 (0: Reinhard, 1: ACES, 2: Filmic) "Curve"

uniform sampler2D source;
uniform float exposure;
uniform float gamma;
uniform float whitePoint;
uniform float curve;

vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 filmic(vec3 x) {
  x = max(vec3(0.0), x - 0.004);
  return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  vec3 hdr = max(color.rgb * exposure, 0.0);
  vec3 mapped = hdr / (hdr + vec3(max(whitePoint, 0.0001)));
  if (curve > 0.5 && curve < 1.5) mapped = aces(hdr / max(whitePoint, 0.0001));
  if (curve >= 1.5) mapped = filmic(hdr / max(whitePoint, 0.0001));
  mapped = pow(max(mapped, 0.0), vec3(1.0 / max(gamma, 0.0001)));

  fragColor = vec4(mapped, color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Tone-map bright or float texture values with exposure and curve controls.',
  data: { code: code.trim() }
};
