import type { GLSLPreset } from './types';

const code = `// @title Position Field
// @format rgba32f
// @resolution 256

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float theta = uv.y * 3.14159265;
  float phi   = uv.x * 6.28318530;

  vec3 p = vec3(
    sin(theta) * cos(phi),
    sin(theta) * sin(phi),
    cos(theta)
  );

  float t = iTime * 0.4;
  float n = noise(p * 2.0 + vec3(0.0, 0.0, t));
  float r = 1.0 + (n - 0.5) * 0.8;

  float swirl = noise(p * 1.2 + vec3(t, 0.0, 0.0)) * 2.0;
  float c = cos(swirl), s = sin(swirl);
  p.xz = mat2(c, -s, s, c) * p.xz;

  fragColor = vec4(p * r, 1.0);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Generate a float position field for GPU geometry workflows.',
  data: { code: code.trim() }
};
