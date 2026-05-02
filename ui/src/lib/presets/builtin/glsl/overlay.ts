import type { GLSLPreset } from './types';

const code = `// @title Overlay
// @primaryButton settings
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D background;
uniform sampler2D foreground;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 fg = texture(foreground, uv);
  vec4 bg = texture(background, uv);
  float alpha = fg.a * opacity;

  fragColor = mix(
    bg,
    fg,
    alpha
  );
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Alpha-composite a foreground input over a background input.',
  data: { code: code.trim() }
};
