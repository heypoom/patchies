import type { GLSLPreset } from './types';

const code = `// @title Subtract
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"
// @param clampOutput true "Clamp Output"
// @noinlet clampOutput

uniform sampler2D a;
uniform sampler2D b;
uniform float opacity;
uniform bool clampOutput;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 ca = texture(a, uv);
  vec4 cb = texture(b, uv);
  vec4 subtracted = vec4(ca.rgb - cb.rgb * opacity, ca.a);

  fragColor = clampOutput ? clamp(subtracted, 0.0, 1.0) : subtracted;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Subtract one texture from another with opacity and optional clamping.',
  data: { code: code.trim() }
};
