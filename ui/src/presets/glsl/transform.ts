import type { GLSLPreset } from './types';

const code = `// @title Transform
// @primaryButton settings
// @param translateX 0.0 -1.0 1.0 0.001 "Translate X"
// @param translateY 0.0 -1.0 1.0 0.001 "Translate Y"
// @param scale 1.0 0.05 4.0 0.001 "Scale"
// @param rotation 0.0 -3.1416 3.1416 0.001 "Rotation"
// @param repeatMode 0 (0: Clamp, 1: Repeat, 2: Mirror) "Repeat Mode"

uniform sampler2D source;
uniform float translateX;
uniform float translateY;
uniform float scale;
uniform float rotation;
uniform float repeatMode;

vec2 mirrorRepeat(vec2 p) {
  vec2 f = fract(p);
  vec2 tile = mod(floor(p), 2.0);
  return mix(f, 1.0 - f, tile);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - 0.5;
  float c = cos(rotation);
  float s = sin(rotation);
  p = mat2(c, -s, s, c) * p;
  p = p / max(scale, 0.0001);
  p += 0.5 - vec2(translateX, translateY);

  vec2 sampleUv = p;
  float alpha = 1.0;
  if (repeatMode > 1.5) {
    sampleUv = mirrorRepeat(p);
  } else if (repeatMode > 0.5) {
    sampleUv = fract(p);
  } else {
    alpha = step(0.0, p.x) * step(0.0, p.y) * step(p.x, 1.0) * step(p.y, 1.0);
  }

  vec4 color = texture(source, sampleUv);
  fragColor = vec4(color.rgb, color.a * alpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Translate, scale, rotate, and tile an input texture.',
  data: { code: code.trim() }
};
