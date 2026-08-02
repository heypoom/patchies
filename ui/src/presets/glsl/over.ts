import type { GLSLPreset } from './types';

const code = `// @title Over
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D background;
uniform sampler2D foreground;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 bg = texture(background, uv);
  vec4 fg = texture(foreground, uv);
  float alpha = clamp(fg.a * opacity, 0.0, 1.0);
  float outAlpha = alpha + bg.a * (1.0 - alpha);
  vec3 rgb = (fg.rgb * alpha + bg.rgb * bg.a * (1.0 - alpha)) / max(outAlpha, 0.0001);

  fragColor = vec4(rgb, outAlpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Place a foreground texture over a background using alpha.',
  data: { code: code.trim() }
};
