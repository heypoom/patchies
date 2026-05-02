import type { GLSLPreset } from './types';

const code = `// @title Channel Mix
// @primaryButton settings
// @param rr 1.0 -2.0 2.0 0.001 "Red <- Red"
// @param rg 0.0 -2.0 2.0 0.001 "Red <- Green"
// @param rb 0.0 -2.0 2.0 0.001 "Red <- Blue"
// @param gr 0.0 -2.0 2.0 0.001 "Green <- Red"
// @param gg 1.0 -2.0 2.0 0.001 "Green <- Green"
// @param gb 0.0 -2.0 2.0 0.001 "Green <- Blue"
// @param br 0.0 -2.0 2.0 0.001 "Blue <- Red"
// @param bg 0.0 -2.0 2.0 0.001 "Blue <- Green"
// @param bb 1.0 -2.0 2.0 0.001 "Blue <- Blue"
// @param opacity 1.0 0.0 1.0 0.001 "Opacity"

uniform sampler2D source;
uniform float rr;
uniform float rg;
uniform float rb;
uniform float gr;
uniform float gg;
uniform float gb;
uniform float br;
uniform float bg;
uniform float bb;
uniform float opacity;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  mat3 matrix = mat3(
    rr, gr, br,
    rg, gg, bg,
    rb, gb, bb
  );
  vec3 mixed = matrix * color.rgb;
  fragColor = vec4(mix(color.rgb, mixed, opacity), color.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Mix RGB channels with a 3x3 color matrix.',
  data: { code: code.trim() }
};
