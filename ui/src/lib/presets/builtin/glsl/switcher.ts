import type { GLSLPreset } from './types';

const code = `// @title Switcher
// @primaryButton settings
// @param id 0 (0: A, 1: B, 2: C, 3: D, 4: E, 5: F) "Input"

uniform sampler2D a;
uniform sampler2D b;
uniform sampler2D c;
uniform sampler2D d;
uniform sampler2D e;
uniform sampler2D f;
uniform float id;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 o;

  if (id < 0.5) o = texture(a, uv);
  if (id >= 0.5 && id < 1.5) o = texture(b, uv);
  if (id >= 1.5 && id < 2.5) o = texture(c, uv);
  if (id >= 2.5 && id < 3.5) o = texture(d, uv);
  if (id >= 3.5 && id < 4.5) o = texture(e, uv);
  if (id >= 4.5) o = texture(f, uv);

  fragColor = o;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Select one of six video inputs.',
  data: { code: code.trim() }
};
