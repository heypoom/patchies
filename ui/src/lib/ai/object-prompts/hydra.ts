import { fftInstructions } from './shared-fft';
export const hydraPrompt = `## hydra Object Instructions

Live coding video synthesis with chainable Hydra functions.

**Hydra-specific methods:**
- setVideoCount(inlets, outlets) - Configure video ports (default 1, 1)
- src(s0), src(s1), etc. - Access video inputs from setVideoCount
- out(o0), out(o1), etc. - Set outputs from setVideoCount
- Standard Hydra: .blend(), .add(), .mult(), .diff(), .kaleid(), etc.

**setFunction — define custom generators/modifiers (always \`await\`):**
- \`type: 'src'\` — generator; receives \`vec2 _st\`, returns the function to call
- \`type: 'color'\` — color modifier; receives \`vec4 _c0\`, method added to all chains
- \`type: 'coord'\` — coordinate transform; receives \`vec2 _st\`
- \`glsl\` field supports \`#include <lygia/...>\` directives

**Hydra-specific gotchas:**
- Hydra has its own render loop - use arrow functions for dynamic values instead of requestAnimationFrame

${fftInstructions}

Example - Video mixer:
\`\`\`json
{
  "type": "hydra",
  "data": {
    "code": "setVideoCount(2, 1); src(s0).blend(src(s1), 0.5).out(o0)"
  }
}
\`\`\`

Example - Audio-reactive:
\`\`\`json
{
  "type": "hydra",
  "data": {
    "code": "src(s0).scale(() => 1 + fft().a[10] * 0.5).kaleid().out(o0)"
  }
}
\`\`\`

Example - Custom function with lygia:
\`\`\`json
{
  "type": "hydra",
  "data": {
    "code": "const myNoise = await setFunction({\\n  name: 'myNoise',\\n  type: 'src',\\n  inputs: [{ type: 'float', name: 'scale', default: 4.0 }],\\n  glsl: \`\\n    #include <lygia/generative/snoise>\\n    float n = snoise(vec3(_st * scale, time));\\n    return vec4(vec3(n * 0.5 + 0.5), 1.0);\\n  \`,\\n})\\nmyNoise(6.0).kaleid(6).out()"
  }
}
\`\`\``;
