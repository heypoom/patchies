import type { GLSLPreset } from './types';

const code = `// @title Tile
// @primaryButton settings
// @param repeatX 2.0 1.0 16.0 0.001 "Repeat X"
// @param repeatY 2.0 1.0 16.0 0.001 "Repeat Y"
// @param offsetX 0.0 -1.0 1.0 0.001 "Offset X"
// @param offsetY 0.0 -1.0 1.0 0.001 "Offset Y"
// @param mirror false "Mirror"

uniform sampler2D source;
uniform float repeatX;
uniform float repeatY;
uniform float offsetX;
uniform float offsetY;
uniform bool mirror;

vec2 mirrorRepeat(vec2 p) {
  vec2 f = fract(p);
  vec2 tile = mod(floor(p), 2.0);
  return mix(f, 1.0 - f, tile);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv * vec2(repeatX, repeatY) + vec2(offsetX, offsetY);
  vec2 sampleUv = mirror ? mirrorRepeat(p) : fract(p);
  fragColor = texture(source, sampleUv);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Repeat a source texture with offset and optional mirror tiling.',
  data: { code: code.trim() }
};
