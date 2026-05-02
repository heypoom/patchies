import type { GLSLPreset } from './types';

const code = `// @title Pack
// @primaryButton settings
// @param redChannel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Red Channel"
// @param greenChannel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Green Channel"
// @param blueChannel 0 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Blue Channel"
// @param alphaChannel 4 (0: Luma, 1: Red, 2: Green, 3: Blue, 4: Alpha) "Alpha Channel"
// @param invertAlpha false "Invert Alpha"

uniform sampler2D redSource;
uniform sampler2D greenSource;
uniform sampler2D blueSource;
uniform sampler2D alphaSource;
uniform float redChannel;
uniform float greenChannel;
uniform float blueChannel;
uniform float alphaChannel;
uniform bool invertAlpha;

float readChannel(vec4 color, float channel) {
  if (channel < 0.5) return dot(color.rgb, vec3(0.299, 0.587, 0.114));
  if (channel < 1.5) return color.r;
  if (channel < 2.5) return color.g;
  if (channel < 3.5) return color.b;
  return color.a;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float r = readChannel(texture(redSource, uv), redChannel);
  float g = readChannel(texture(greenSource, uv), greenChannel);
  float b = readChannel(texture(blueSource, uv), blueChannel);
  float a = readChannel(texture(alphaSource, uv), alphaChannel);
  if (invertAlpha) a = 1.0 - a;

  fragColor = vec4(r, g, b, a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Pack channels from four texture inputs into one RGBA texture.',
  data: { code: code.trim() }
};
