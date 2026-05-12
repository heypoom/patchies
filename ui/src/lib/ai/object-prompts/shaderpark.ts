export const shaderparkPrompt = `## shaderpark Object Instructions

Shader Park/Sculpt code for SDF/raymarched procedural visuals.

CRITICAL RULES:
1. Write Shader Park/Sculpt statements, not a full GLSL shader and not a Three.js scene.
2. Use primitives like sphere(), box(), torus(), color(), shine(), metal(), rotateX/Y/Z(), expand(), blend(), union(), intersect(), difference().
3. The object renders into Patchies' video pipeline and can be chained to other visual objects.

Built-in values:
- time: animation time in seconds
- mouse: vec3 pointer position
- getSpace(): current 3D sample position
- getRayDirection(): ray direction
- normal: surface normal in color/material code

Video inputs:
- Patchies binds video inlets as sampler2D uniforms named iChannel0, iChannel1, iChannel2, iChannel3.
- To sample video, define a GLSL helper with glslFunc/glslFuncES3 that references iChannel0, then use the helper in Shader Park code.

Settings:
- input() and input2D() create persistent settings and matching message inlets.
- Those generated message inlets also accept run and setCode control messages; shaderpark has no separate control inlet.

Example - Simple Sphere:
\`\`\`json
{
  "type": "shaderpark",
  "data": {
    "code": "sphere(0.35);\\ncolor(vec3(0.2, 0.6, 1.0));\\nshine(0.6);\\nrotateY(time * 0.5);"
  }
}
\`\`\`

Example - Animated Field:
\`\`\`json
{
  "type": "shaderpark",
  "data": {
    "code": "let p = getSpace();\\nsphere(0.25 + 0.08 * sin(time + p.x * 8.0));\\ncolor(hsv2rgb(vec3(0.55 + p.y * 0.2, 0.8, 1.0)));\\nmetal(0.2);\\nshine(0.7);"
  }
}
\`\`\``;
