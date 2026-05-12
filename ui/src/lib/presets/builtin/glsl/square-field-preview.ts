import type { GLSLPreset } from './types';

const code = `// @title Square Field Preview
// @resolution 512

uniform sampler2D field;

const int FIELD_SIZE = 32;
const float PI = 3.14159265359;

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(PI * 2.0 * (vec3(0.0, 0.33, 0.67) + t));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= iResolution.x / iResolution.y;

  vec3 color = vec3(0.01, 0.01, 0.015);

  for (int i = 0; i < FIELD_SIZE * FIELD_SIZE; i++) {
    int x = i % FIELD_SIZE;
    int y = i / FIELD_SIZE;
    vec2 fieldUv = (vec2(float(x), float(y)) + 0.5) / float(FIELD_SIZE);
    vec4 point = texture(field, fieldUv);

    vec2 position = point.xy;
    float height = point.z;
    float radius = mix(0.004, 0.018, height * 0.5 + 0.5);
    float d = length(p - position);
    float glow = smoothstep(radius, 0.0, d);

    color += palette(height * 0.15 + iTime * 0.05) * glow * point.a;
  }

  fragColor = vec4(color, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Preview square-packed float.tex XYZW data as a point field.',
  data: { code: code.trim() }
};
