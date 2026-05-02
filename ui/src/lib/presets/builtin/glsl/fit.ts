import type { GLSLPreset } from './types';

const code = `// @title Fit
// @primaryButton settings
// @param mode 0 (0: Contain, 1: Cover, 2: Stretch) "Mode"
// @param inputAspect 1.7778 0.1 4.0 0.0001 "Input Aspect"
// @param background color #000000 "Background"
// @param backgroundAlpha 0.0 0.0 1.0 0.001 "Background Alpha"

uniform sampler2D source;
uniform float mode;
uniform float inputAspect;
uniform vec3 background;
uniform float backgroundAlpha;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float outputAspect = iResolution.x / max(iResolution.y, 0.0001);
  float sourceAspect = max(inputAspect, 0.0001);
  vec2 p = uv;

  if (mode < 1.5) {
    if (mode < 0.5) {
      vec2 displayScale = sourceAspect > outputAspect
        ? vec2(1.0, outputAspect / sourceAspect)
        : vec2(sourceAspect / outputAspect, 1.0);
      p = (uv - 0.5) / displayScale + 0.5;
    } else {
      vec2 sampleScale = sourceAspect > outputAspect
        ? vec2(outputAspect / sourceAspect, 1.0)
        : vec2(1.0, sourceAspect / outputAspect);
      p = (uv - 0.5) * sampleScale + 0.5;
    }
  }

  bool inside = p.x >= 0.0 && p.y >= 0.0 && p.x <= 1.0 && p.y <= 1.0;
  fragColor = inside ? texture(source, p) : vec4(background, backgroundAlpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Fit, cover, or stretch a source texture to the output aspect.',
  data: { code: code.trim() }
};
