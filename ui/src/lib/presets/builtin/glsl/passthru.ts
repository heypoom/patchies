import type { GLSLPreset } from './types';

const code = `uniform sampler2D image;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(image, uv);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Pipe video through GLSL shader',
  data: { code: code.trim() }
};
