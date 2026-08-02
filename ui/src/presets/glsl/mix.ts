import type { GLSLPreset } from './types';

const code = `// @title Mix
// @primaryButton settings
// @param iMix 0.5 0.0 1.0 0.001 "Mix"

uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float iMix;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = mix(
    texture(iChannel0, uv),
    texture(iChannel1, uv),
    iMix
  );
}`;

export const preset: GLSLPreset = {
  type: 'glsl',
  description: 'Crossfade between two video inputs.',
  data: { code: code.trim() }
};
