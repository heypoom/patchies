import type { GLSLPreset } from './types';

const code = `// @title HSV to RGB

uniform sampler2D source;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  fragColor = vec4(hsv2rgb(color.rgb), color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Convert HSV texture values stored in RGB channels back to RGB.',
  data: { code: code.trim() }
};
