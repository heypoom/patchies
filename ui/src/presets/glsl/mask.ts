import type { GLSLPreset } from './types';

const code = `// @title Mask
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"
// @param invert false "Invert"
// @param premultiply false "Premultiply"

uniform sampler2D source;
uniform sampler2D mask;
uniform float opacity;
uniform bool invert;
uniform bool premultiply;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float clipAlpha = texture(mask, uv).a;
  if (invert) clipAlpha = 1.0 - clipAlpha;

  color.a *= clipAlpha * opacity;
  if (premultiply) color.rgb *= color.a;

  fragColor = color;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description:
    'Use another texture alpha to clip a source texture, such as a circle or shape mask.',
  data: { code: code.trim() }
};
