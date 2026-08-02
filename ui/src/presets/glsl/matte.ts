import type { GLSLPreset } from './types';

const code = `// @title Matte
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"
// @param invert false "Invert"
// @param premultiply false "Premultiply"

uniform sampler2D source;
uniform sampler2D matte;
uniform float opacity;
uniform bool invert;
uniform bool premultiply;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  vec4 matteColor = texture(matte, uv);
  float mask = dot(matteColor.rgb, vec3(0.299, 0.587, 0.114));
  if (invert) mask = 1.0 - mask;

  color.a *= mask * opacity;
  if (premultiply) color.rgb *= color.a;

  fragColor = color;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Apply a grayscale matte texture to the alpha of a source texture.',
  data: { code: code.trim() }
};
