import type { GLSLPreset } from './types';

const code = `// @title Crop
// @primaryButton settings
// @param minX 0.0 0.0 1.0 0.001 "Min X"
// @param minY 0.0 0.0 1.0 0.001 "Min Y"
// @param maxX 1.0 0.0 1.0 0.001 "Max X"
// @param maxY 1.0 0.0 1.0 0.001 "Max Y"
// @param feather 0.0 0.0 0.25 0.001 "Feather"

uniform sampler2D source;
uniform float minX;
uniform float minY;
uniform float maxX;
uniform float maxY;
uniform float feather;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 lo = min(vec2(minX, minY), vec2(maxX, maxY));
  vec2 hi = max(vec2(minX, minY), vec2(maxX, maxY));
  vec2 size = max(hi - lo, vec2(0.0001));
  vec2 sampleUv = (uv - lo) / size;
  vec2 edgeIn = smoothstep(lo, lo + feather, uv);
  vec2 edgeOut = 1.0 - smoothstep(hi - feather, hi, uv);
  float mask = edgeIn.x * edgeIn.y * edgeOut.x * edgeOut.y;
  fragColor = texture(source, sampleUv) * mask;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Crop an input texture with optional feathering.',
  data: { code: code.trim() }
};
