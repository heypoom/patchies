import type { GLSLPreset } from './types';

const code = `// @title Feedback
// @primaryButton settings
// @param feedbackAmount 0.9 0.0 0.999 0.001 "Feedback"
// @param inputAmount 1.0 0.0 1.0 0.001 "Input"
// @param decay 0.98 0.0 1.0 0.001 "Decay"
// @param zoom 1.0 0.8 1.2 0.001 "Zoom"
// @param rotation 0.0 -0.2 0.2 0.0001 "Rotation"

uniform sampler2D source;
uniform sampler2D feedback;
uniform float feedbackAmount;
uniform float inputAmount;
uniform float decay;
uniform float zoom;
uniform float rotation;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = uv - 0.5;
  float c = cos(rotation);
  float s = sin(rotation);
  p = mat2(c, -s, s, c) * p;
  p = p / max(zoom, 0.0001) + 0.5;

  vec4 current = texture(source, uv) * inputAmount;
  vec4 previous = texture(feedback, p) * decay * feedbackAmount;
  fragColor = max(current, previous);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Accumulate an input with a manually wired feedback inlet.',
  data: { code: code.trim() }
};
