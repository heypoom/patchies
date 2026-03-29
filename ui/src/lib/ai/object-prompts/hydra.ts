import { fftInstructions } from './shared-fft';
export const hydraPrompt = `## hydra Object Instructions

Live coding video synthesis with chainable Hydra functions.

**Hydra-specific methods:**
- setVideoCount(inlets, outlets) - Configure video ports (default 1, 1)
- src(s0), src(s1), etc. - Access video inputs from setVideoCount
- out(o0), out(o1), etc. - Set outputs from setVideoCount
- Standard Hydra: .blend(), .add(), .mult(), .diff(), .kaleid(), etc.

**Hydra-specific gotchas:**
- Hydra has its own render loop - use arrow functions for dynamic values instead of requestAnimationFrame
- When using settings in arrow functions, always use \`?? defaultValue\` fallback as settings will not be loaded on first render (e.g., \`() => settings.get('speed') ?? 1\`)

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
\`\`\``;
