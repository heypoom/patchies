export const glslPrompt = `## glsl Object Instructions

GLSL fragment shader for visual effects. Uses Shadertoy-compatible format.

**\`#include\` directives are auto-preprocessed** before compilation — use them freely.

CRITICAL RULES:
1. MUST use mainImage function signature: void mainImage(out vec4 fragColor, in vec2 fragCoord)
2. Write GLSL code, NOT JavaScript
3. Shaders are Shadertoy-compatible
4. Define custom uniforms for dynamic control

**Multi-Render Target (MRT) — multiple video outlets from one shader:**
- Declare \`layout(location = N) out vec4 name;\` variables (auto-detected, creates N outlets)
- When using MRT, mainImage signature changes to: \`void mainImage(vec2 fragCoord)\` (no out param — write to your declared outputs directly)
- Example: 2 outputs → \`layout(location = 0) out vec4 albedo;\` + \`layout(location = 1) out vec4 normals;\`

**Metadata directives** (comment-based):
- \`// @title My Shader\` — sets node display title
- \`// @param name default min max [step] "description"\` — adds ranged slider for a uniform.
    Each @param MUST have a matching \`uniform\` declaration
    e.g. \`// @param strength 0.5 0.0 1.0 "Effect strength"\`
    e.g. \`// @param fine 0.5 0.0 1.0 0.001 "Fine control"\`
    requires \`uniform float strength;\`
    IMPORTANT: default value, then min, max, and optional step!
- \`// @param name color [#hex] ["title"]\` — renders a vec3 uniform as a color picker.
    Use \`color\` as the default value. Add an optional hex default, then an optional quoted title.
    The quoted title becomes the settings label.
    Only works with \`vec3\` uniforms.
    e.g. \`// @param tint color #ff8800 "Tint Color"\` with \`uniform vec3 tint;\`
- \`// @param name default (value: Label, value: Label) "title"\` — renders a numeric uniform as select buttons.
    Use this for discrete modes instead of sliders.
    e.g. \`// @param mode 0 (0: Linear, 1: Radial, 2: Circular) "Mode"\` with \`uniform float mode;\`
- \`// @noinlet name[, otherName]\` — hides matching uniform inlet handles while keeping ObjectSettings UI control.
    Use this when a uniform should be changed only from settings, not patch cables.
    e.g. \`// @noinlet mode\` with \`uniform int mode;\`
- \`// @format rgba32f\` (or \`rgba16f\`) — unclamped float output (default \`rgba8\`)
- \`// @resolution 256\` — sets FBO size (256×256).
    Also supports \`256x128\`, \`1/n\` (e.g. \`1/2\`, \`1/4\`, \`1/8\`).
    Default is full window resolution.

**FFT Audio Analysis (GLSL-specific):**
- Create sampler2D uniform and connect fft~ object's purple "analyzer" outlet
- Use "waveTexture" uniform name for waveform (time-domain)
- Any other sampler2D name gets frequency spectrum
- Example: uniform sampler2D fftData; (frequency) or uniform sampler2D waveTexture; (waveform)

Built-in uniforms (Shadertoy-compatible):
- iResolution: vec3 (viewport resolution, z is pixel aspect ratio)
- iTime: float (shader playback time in seconds)
- iMouse: vec4 (mouse interaction)
  * xy: current mouse position or last click position
  * zw: drag start position (positive when mouse down, negative when mouse up)
  * When mouse is down (dragging): zw > 0 (ongoing drag start position)
  * When mouse is up (released): zw < 0 (use abs() to get last drag start position)
  * Using iMouse in your shader enables mouse interaction automatically
- iFrame: int (shader playback frame)

Custom uniforms:
- uniform float iMix: creates a float inlet
- uniform vec2 iFoo: creates a vec2 inlet
- uniform sampler2D iChannel0: creates a video inlet (orange)

Example - Solid Red:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  fragColor = vec4(1.0, 0.0, 0.0, 1.0);\\n}"
  }
}
\`\`\`

Example - Animated Colors:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "void mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  vec2 uv = fragCoord / iResolution.xy;\\n  vec3 color = vec3(0.0);\\n  float time = iTime * 0.5;\\n  \\n  color.r = sin(uv.x * 10.0 + time) * 0.5 + 0.5;\\n  color.g = sin(uv.y * 10.0 + time * 1.2) * 0.5 + 0.5;\\n  color.b = sin((uv.x + uv.y) * 5.0 + time * 0.8) * 0.5 + 0.5;\\n  \\n  float brightness = sin(time * 2.0) * 0.2 + 0.8;\\n  color *= brightness;\\n  fragColor = vec4(color, 1.0);\\n}"
  }
}
\`\`\`

Example - With Custom Uniform:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "uniform float iMix;\\n\\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  vec2 uv = fragCoord / iResolution.xy;\\n  vec3 color = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), iMix);\\n  fragColor = vec4(color * uv.x, 1.0);\\n}"
  }
}
\`\`\`

Example - With Video Input:
\`\`\`json
{
  "type": "glsl",
  "data": {
    "code": "uniform sampler2D iChannel0;\\n\\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) {\\n  vec2 uv = fragCoord / iResolution.xy;\\n  vec3 tex = texture(iChannel0, uv).rgb;\\n  fragColor = vec4(tex * 1.2, 1.0);\\n}"
  }
}
\`\`\``;
