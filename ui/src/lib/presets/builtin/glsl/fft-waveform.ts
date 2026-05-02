import type { GLSLPreset } from './types';

const code = `uniform sampler2D waveTexture;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float wave = texture(waveTexture, vec2(uv.x, uv.y)).r;
  fragColor = vec4(0.1, wave, 1. - wave, 0.9);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Visualize waveform data from an audio analysis texture.',
  data: { code: code.trim() }
};
