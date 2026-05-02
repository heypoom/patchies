import type { GLSLPreset } from './types';

const code = `// @title HSV Adjust
// @primaryButton settings
// @param hue 0.0 -1.0 1.0 0.001 "Hue"
// @param saturation 1.0 0.0 3.0 0.001 "Saturation"
// @param value 1.0 0.0 3.0 0.001 "Value"
// @param amount 1.0 0.0 1.0 0.001 "Amount"

uniform sampler2D source;
uniform float hue;
uniform float saturation;
uniform float value;
uniform float amount;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 0.0000001;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  vec3 hsv = rgb2hsv(color.rgb);
  hsv.x = fract(hsv.x + hue);
  hsv.y = clamp(hsv.y * saturation, 0.0, 1.0);
  hsv.z = max(hsv.z * value, 0.0);
  vec3 adjusted = hsv2rgb(hsv);

  fragColor = vec4(mix(color.rgb, adjusted, amount), color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Adjust hue, saturation, and value for a source texture.',
  data: { code: code.trim() }
};
