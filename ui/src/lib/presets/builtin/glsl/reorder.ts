import type { GLSLPreset } from './types';

const code = `// @title Reorder
// @primaryButton settings
// @param red 0 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Red Source"
// @param green 1 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Green Source"
// @param blue 2 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Blue Source"
// @param alpha 3 (0: Red, 1: Green, 2: Blue, 3: Alpha, 4: Luma) "Alpha Source"
// @param invertAlpha false "Invert Alpha"

uniform sampler2D source;
uniform float red;
uniform float green;
uniform float blue;
uniform float alpha;
uniform bool invertAlpha;

float channel(vec4 color, float source) {
  if (source < 0.5) return color.r;
  if (source < 1.5) return color.g;
  if (source < 2.5) return color.b;
  if (source < 3.5) return color.a;
  return dot(color.rgb, vec3(0.299, 0.587, 0.114));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float a = channel(color, alpha);
  if (invertAlpha) a = 1.0 - a;
  fragColor = vec4(
    channel(color, red),
    channel(color, green),
    channel(color, blue),
    a
  );
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Swizzle color and alpha channels.',
  data: { code: code.trim() }
};
