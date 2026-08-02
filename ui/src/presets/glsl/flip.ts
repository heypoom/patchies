import type { GLSLPreset } from './types';

const code = `// @title Flip
// @primaryButton settings
// @param horizontal true "Horizontal"
// @param vertical false "Vertical"

uniform sampler2D source;
uniform bool horizontal;
uniform bool vertical;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv;
  if (horizontal) p.x = 1.0 - p.x;
  if (vertical) p.y = 1.0 - p.y;

  fragColor = texture(source, p);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Flip a source texture horizontally and/or vertically.',
  data: { code: code.trim() }
};
