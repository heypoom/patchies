import type { GLSLPreset } from './types';

const code = `// @title Add
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"
// @param clampOutput true "Clamp Output"

uniform sampler2D a;
uniform sampler2D b;
uniform float opacity;
uniform bool clampOutput;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 ca = texture(a, uv);
  vec4 cb = texture(b, uv);
  vec4 added = vec4(ca.rgb + cb.rgb * opacity, max(ca.a, cb.a * opacity));

  fragColor = clampOutput ? clamp(added, 0.0, 1.0) : added;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Add two textures with opacity and optional clamping.',
  data: { code: code.trim() }
};
