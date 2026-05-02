import type { GLSLPreset } from './types';

const code = `// @title Edge
// @primaryButton settings
// @param strength 1.0 0.0 5.0 0.001 "Strength"
// @param threshold 0.05 0.0 1.0 0.001 "Threshold"
// @param monochrome true "Monochrome"

uniform sampler2D source;
uniform float strength;
uniform float threshold;
uniform bool monochrome;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = 1.0 / iResolution.xy;
  float tl = luma(texture(source, uv + px * vec2(-1.0,  1.0)).rgb);
  float tc = luma(texture(source, uv + px * vec2( 0.0,  1.0)).rgb);
  float tr = luma(texture(source, uv + px * vec2( 1.0,  1.0)).rgb);
  float ml = luma(texture(source, uv + px * vec2(-1.0,  0.0)).rgb);
  float mr = luma(texture(source, uv + px * vec2( 1.0,  0.0)).rgb);
  float bl = luma(texture(source, uv + px * vec2(-1.0, -1.0)).rgb);
  float bc = luma(texture(source, uv + px * vec2( 0.0, -1.0)).rgb);
  float br = luma(texture(source, uv + px * vec2( 1.0, -1.0)).rgb);

  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -bl - 2.0 * bc - br + tl + 2.0 * tc + tr;
  float edge = smoothstep(threshold, 1.0, length(vec2(gx, gy)) * strength);
  vec4 sourceColor = texture(source, uv);
  fragColor = monochrome
    ? vec4(vec3(edge), sourceColor.a)
    : vec4(sourceColor.rgb * edge, sourceColor.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Detect image edges with a Sobel-style filter.',
  data: { code: code.trim() }
};
