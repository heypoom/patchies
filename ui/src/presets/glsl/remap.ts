import type { GLSLPreset } from './types';

const code = `// @title Remap
// @param extend 0 (0: Clamp, 1: Repeat, 2: Mirror) "Extend Mode"
// @noinlet extend

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float extend;

vec2 applyExtend(vec2 uv, float mode) {
  if (mode < 0.5) {
    // Clamp
    return clamp(uv, 0.0, 1.0);
  } else if (mode < 1.5) {
    // Repeat
    return fract(uv);
  } else {
    // Mirror
    vec2 t = fract(uv * 0.5) * 2.0;
    return 1.0 - abs(t - 1.0);
  }
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // UV into the remap (second input)
  vec2 uv = fragCoord / iResolution.xy;

  // Sample the remap map - needs to be high precision (16/32-bit recommended)
  vec4 remap = texture(iChannel1, uv);

  // Red channel = horizontal position in source (0=left, 1=right)
  // Green channel = vertical position in source (0=bottom, 1=top)
  // In GLSL texture space, V=0 is bottom, so green maps directly
  vec2 sourceUV = vec2(remap.r, remap.g);

  // Apply extend/wrap mode
  sourceUV = applyExtend(sourceUV, extend);

  // Sample the source (first input) at the remapped UV
  vec4 color = texture(iChannel0, sourceUV);

  fragColor = color;
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Use red and green channels from a second input to remap source UVs.',
  data: { code: code.trim() }
};
