import type { GLSLPreset } from './types';

const code = `// @title Composite
// @primaryButton settings
// @param mode 0 (0: Over, 1: Add, 2: Multiply, 3: Screen, 4: Difference, 5: Overlay) "Mode"
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D background;
uniform sampler2D foreground;
uniform float mode;
uniform float opacity;

vec3 blendOverlay(vec3 bg, vec3 fg) {
  vec3 low = 2.0 * bg * fg;
  vec3 high = 1.0 - 2.0 * (1.0 - bg) * (1.0 - fg);
  return mix(low, high, step(0.5, bg));
}

vec4 over(vec4 bg, vec4 fg) {
  float alpha = clamp(fg.a * opacity, 0.0, 1.0);
  float outAlpha = alpha + bg.a * (1.0 - alpha);
  vec3 rgb = (fg.rgb * alpha + bg.rgb * bg.a * (1.0 - alpha)) / max(outAlpha, 0.0001);
  return vec4(rgb, outAlpha);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 bg = texture(background, uv);
  vec4 fg = texture(foreground, uv);

  vec3 blended = fg.rgb;
  if (mode > 0.5 && mode < 1.5) blended = bg.rgb + fg.rgb;
  if (mode >= 1.5 && mode < 2.5) blended = bg.rgb * fg.rgb;
  if (mode >= 2.5 && mode < 3.5) blended = 1.0 - (1.0 - bg.rgb) * (1.0 - fg.rgb);
  if (mode >= 3.5 && mode < 4.5) blended = abs(bg.rgb - fg.rgb);
  if (mode >= 4.5) blended = blendOverlay(bg.rgb, fg.rgb);

  vec4 composite = vec4(clamp(blended, 0.0, 1.0), max(bg.a, fg.a * opacity));
  vec4 blendedComposite = mix(bg, composite, fg.a * opacity);
  fragColor = mode < 0.5 ? over(bg, fg) : blendedComposite;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Composite a foreground over a background with common blend modes.',
  data: { code: code.trim() }
};
