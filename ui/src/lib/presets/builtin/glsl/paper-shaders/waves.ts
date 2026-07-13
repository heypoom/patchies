import type { GLSLPreset } from '../types';
import { sourceNotice, commonUv, mathUtils } from './shared';

const code = `${sourceNotice}
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

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Paper Shaders line pattern that morphs from zigzags into soft waves.',
  data: { code: code.trim() }
};
