import type { GLSLPreset } from './types';

const code = `// @title Limit
// @primaryButton settings
// @param minValue 0.0 -2.0 2.0 0.001 "Min"
// @param maxValue 1.0 -2.0 2.0 0.001 "Max"
// @param mode 0 (0: Clamp, 1: Wrap, 2: Fold) "Mode"

uniform sampler2D source;
uniform float minValue;
uniform float maxValue;
uniform float mode;

vec3 wrapRange(vec3 value, float lo, float hi) {
  float range = max(hi - lo, 0.0001);
  return mod(value - lo, range) + lo;
}

vec3 foldRange(vec3 value, float lo, float hi) {
  float range = max(hi - lo, 0.0001);
  vec3 wrapped = mod(value - lo, range * 2.0);
  return lo + mix(wrapped, range * 2.0 - wrapped, step(range, wrapped));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float lo = min(minValue, maxValue);
  float hi = max(minValue, maxValue);
  vec3 limited = clamp(color.rgb, lo, hi);
  if (mode > 0.5 && mode < 1.5) limited = wrapRange(color.rgb, lo, hi);
  if (mode >= 1.5) limited = foldRange(color.rgb, lo, hi);

  fragColor = vec4(limited, color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Clamp, wrap, or fold RGB values into a chosen range.',
  data: { code: code.trim() }
};
