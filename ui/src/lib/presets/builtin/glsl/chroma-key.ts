import type { GLSLPreset } from './types';

const code = `// @title Chroma Key
// @primaryButton settings
// @param keyColor color #00ff00 "Key Color"
// @param tolerance 0.25 0.0 1.0 0.001 "Tolerance"
// @param softness 0.08 0.0 0.5 0.001 "Softness"
// @param spill 0.5 0.0 1.0 0.001 "Spill"

uniform sampler2D source;
uniform vec3 keyColor;
uniform float tolerance;
uniform float softness;
uniform float spill;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec4 color = texture(source, uv);
  float distanceToKey = distance(color.rgb, keyColor);
  float alpha = smoothstep(tolerance, tolerance + softness, distanceToKey);

  vec3 keyAxis = normalize(max(keyColor, vec3(0.001)));
  float keyAmount = dot(color.rgb, keyAxis);
  vec3 neutralized = color.rgb - keyAxis * keyAmount * (1.0 - alpha) * spill;

  fragColor = vec4(max(neutralized, 0.0), color.a * alpha);
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Key out a chosen chroma color with tolerance, softness, and spill control.',
  data: { code: code.trim() }
};
