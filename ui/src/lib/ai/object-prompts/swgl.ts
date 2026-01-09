export const swglPrompt = `## swgl Object Instructions

SwissGL shader - WebGL2 wrapper for creating shaders in very few lines of code.

CRITICAL RULES:
1. Must implement render() function
2. Uses SwissGL API (different from GLSL)
3. Supports Mesh, VP (vertex position), FP (fragment)
4. Much more concise than raw GLSL

Available:
- glsl(): main SwissGL function
- render({ t }): render function with time parameter
- Mesh: [width, height] for mesh generation
- VP: vertex position string
- FP: fragment color string

Example - Animated Mesh:
\`\`\`json
{
  "type": "swgl",
  "data": {
    "code": "function render({ t }) {\\n  glsl({\\n    t,\\n    Mesh: [10, 10],\\n    VP: \`XY*0.8+sin(t+XY.yx*2.0)*0.2,0,1\`,\\n    FP: \`UV,0.5,1\`,\\n  });\\n}"
  }
}
\`\`\`

HANDLE IDS (Auto-generated):
- Message inlet: "message-in-0" (single, indexed)
- Video outlet: "video-out-0" (single, indexed)
- LIMITATION: Single I/O ports

Example - Color Wave:
\`\`\`json
{
  "type": "swgl",
  "data": {
    "code": "function render({ t }) {\\n  glsl({\\n    t,\\n    FP: \`vec3(sin(t+XY.x*5.0), cos(t+XY.y*3.0), 0.5),1\`,\\n  });\\n}"
  }
}
\`\`\``;
