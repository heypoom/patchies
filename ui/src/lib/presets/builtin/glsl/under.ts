import type { GLSLPreset } from './types';

const code = `// @title Under
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D foreground;
uniform sampler2D background;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 fg = texture(foreground, uv);
  vec4 bg = texture(background, uv);
  fg.a *= opacity;

  float outAlpha = bg.a + fg.a * (1.0 - bg.a);
  vec3 rgb = (bg.rgb * bg.a + fg.rgb * fg.a * (1.0 - bg.a)) / max(outAlpha, 0.0001);

  fragColor = vec4(rgb, outAlpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Place a foreground texture under a background using alpha.',
  data: { code: code.trim() }
};
