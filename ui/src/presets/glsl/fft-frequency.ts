import type { GLSLPreset } from './types';

const code = `uniform sampler2D freqTexture;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float freq = texture(freqTexture, vec2(uv.x/5., uv.y)).r;
  fragColor = vec4(0.1, freq, 1. - freq, 0.9);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Visualize FFT frequency data from an audio analysis texture.',
  data: { code: code.trim() }
};
