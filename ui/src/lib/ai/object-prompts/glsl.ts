export const glslPrompt = `## glsl Object Instructions

GLSL fragment shader for visual effects. Uses Shadertoy-compatible format.

CRITICAL RULES:
1. MUST use mainImage function signature: void mainImage(out vec4 fragColor, in vec2 fragCoord)
2. Write GLSL code, NOT JavaScript
3. Shaders are Shadertoy-compatible
4. Define custom uniforms for dynamic control

HANDLE IDS (Auto-generated - VERY DYNAMIC):
- Output outlet: "video-out" (always present for shader output)
- Uniform inlets depend on your shader code and are auto-generated:
  * "video-in-{index}-{uniformName}-sampler2D" for texture inputs
  * "message-in-{index}-{uniformName}-float" for float inputs
  * "message-in-{index}-{uniformName}-vec3" for vec3 inputs
  * DO NOT try to connect to specific uniform handle IDs in edges
  * Instead, use GLSL uniform names and let the framework match them
- Examples of uniform declarations that create handles:
  * "uniform float iMix" → creates handle for iMix parameter
  * "uniform sampler2D iChannel0" → creates handle for video input

Built-in uniforms:
- iResolution: vec3 (viewport resolution, z is pixel aspect ratio)
- iTime: float (shader playback time in seconds)
- iMouse: vec4 (mouse pixel coords, xy=current, zw=click)
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
