import type { GLSLPreset } from './types';

const code = `// @title Convolve
// @primaryButton settings
// @param kernel 0 (0: Sharpen, 1: Edge, 2: Outline, 3: Box Blur, 4: Gaussian Blur, 5: Emboss) "Kernel"
// @param strength 1.0 0.0 5.0 0.001 "Strength"
// @param bias 0.0 -1.0 1.0 0.001 "Bias"
// @param pixelScale 1.0 0.25 8.0 0.001 "Pixel Scale"
// @param monochrome false "Monochrome"

uniform sampler2D source;
uniform float kernel;
uniform float strength;
uniform float bias;
uniform float pixelScale;
uniform bool monochrome;

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

mat3 kernelMatrix() {
  if (kernel < 0.5) {
    return mat3(
       0.0, -1.0,  0.0,
      -1.0,  5.0, -1.0,
       0.0, -1.0,  0.0
    );
  }
  if (kernel < 1.5) {
    return mat3(
      -1.0, -1.0, -1.0,
      -1.0,  8.0, -1.0,
      -1.0, -1.0, -1.0
    );
  }
  if (kernel < 2.5) {
    return mat3(
       1.0,  1.0,  1.0,
       1.0, -8.0,  1.0,
       1.0,  1.0,  1.0
    );
  }
  if (kernel < 3.5) {
    return mat3(
      1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0,
      1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0,
      1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0
    );
  }
  if (kernel < 4.5) {
    return mat3(
      1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0,
      2.0 / 16.0, 4.0 / 16.0, 2.0 / 16.0,
      1.0 / 16.0, 2.0 / 16.0, 1.0 / 16.0
    );
  }
  return mat3(
    -2.0, -1.0,  0.0,
    -1.0,  1.0,  1.0,
     0.0,  1.0,  2.0
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 px = pixelScale / iResolution.xy;
  mat3 k = kernelMatrix();

  vec4 c00 = texture(source, uv + px * vec2(-1.0, -1.0));
  vec4 c10 = texture(source, uv + px * vec2( 0.0, -1.0));
  vec4 c20 = texture(source, uv + px * vec2( 1.0, -1.0));
  vec4 c01 = texture(source, uv + px * vec2(-1.0,  0.0));
  vec4 c11 = texture(source, uv);
  vec4 c21 = texture(source, uv + px * vec2( 1.0,  0.0));
  vec4 c02 = texture(source, uv + px * vec2(-1.0,  1.0));
  vec4 c12 = texture(source, uv + px * vec2( 0.0,  1.0));
  vec4 c22 = texture(source, uv + px * vec2( 1.0,  1.0));

  vec4 convolved =
    c00 * k[0][0] + c10 * k[1][0] + c20 * k[2][0] +
    c01 * k[0][1] + c11 * k[1][1] + c21 * k[2][1] +
    c02 * k[0][2] + c12 * k[1][2] + c22 * k[2][2];

  vec3 rgb = convolved.rgb + bias;
  if (monochrome) {
    rgb = vec3(luma(rgb));
  }

  fragColor = vec4(mix(c11.rgb, rgb, strength), c11.a);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Apply a named 3x3 convolution kernel to a source texture.',
  data: { code: code.trim() }
};
