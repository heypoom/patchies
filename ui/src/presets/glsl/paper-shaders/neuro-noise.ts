import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Glowing Paper Shaders neuro-noise line field.',
  data: { code: code.trim() }
};
