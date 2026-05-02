import type { GLSLPreset } from './types';

const code = `uniform sampler2D image;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(image, uv);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Passthrough shader for processing a video input.',
  data: { code: code.trim() }
};
