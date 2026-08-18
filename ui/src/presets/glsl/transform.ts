import type { GLSLPreset } from './types';

const code = `// @title Transform
// @primaryButton settings
// @param translateX 0.0 -1.0 1.0 0.001 "Translate X"
// @param translateY 0.0 -1.0 1.0 0.001 "Translate Y"
// @param scale 1.0 0.05 4.0 0.001 "Scale"
// @param rotation 0.0 -3.1416 3.1416 0.001 "Rotation"
// @param fitMode 0 (0: Contain, 1: Cover, 2: Stretch) "Fit"
// @param repeatMode 0 (0: Clamp, 1: Repeat, 2: Mirror) "Repeat Mode"

uniform sampler2D source;
uniform float translateX;
uniform float translateY;
uniform float scale;
uniform float rotation;
uniform float fitMode;
uniform float repeatMode;

vec2 mirrorRepeat(vec2 p) {
  vec2 f = fract(p);
  vec2 tile = mod(floor(p), 2.0);

  return mix(f, 1.0 - f, tile);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float outputAspect = iResolution.x / max(iResolution.y, 0.0001);
  ivec2 sourceSize = textureSize(source, 0);
  float sourceAspect = float(sourceSize.x) / max(float(sourceSize.y), 0.0001);

  // Physical output-height units keep rotation and uniform scale visually
  // consistent on non-square outputs.
  vec2 p = (uv - 0.5) * vec2(outputAspect, 1.0);
  p -= vec2(translateX * outputAspect, translateY);

  float c = cos(rotation);
  float s = sin(rotation);

  p = mat2(c, -s, s, c) * p;
  p = p / max(scale, 0.0001);

  vec2 sampleUv;

  if (fitMode < 1.5) {
    float fitScale = fitMode < 0.5
      ? min(outputAspect / sourceAspect, 1.0)
      : max(outputAspect / sourceAspect, 1.0);

    sampleUv = p / vec2(sourceAspect * fitScale, fitScale) + 0.5;
  } else {
    // Stretch remains available when filling the output matters more than
    // preserving the source proportions.
    sampleUv = p / vec2(outputAspect, 1.0) + 0.5;
  }

  float alpha = 1.0;

  if (repeatMode > 1.5) {
    sampleUv = mirrorRepeat(sampleUv);
  } else if (repeatMode > 0.5) {
    sampleUv = fract(sampleUv);
  } else {
    alpha = step(0.0, sampleUv.x) * step(0.0, sampleUv.y) *
      step(sampleUv.x, 1.0) * step(sampleUv.y, 1.0);
  }

  vec4 color = texture(source, sampleUv);
  fragColor = vec4(color.rgb, color.a * alpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Translate, scale, rotate, and tile an input texture.',
  data: { code: code.trim() }
};
