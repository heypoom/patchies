import { fftInstructions } from './shared-fft';

export const reglPrompt = `## regl Object Instructions

Low-level GPU rendering using [regl](https://github.com/regl-project/regl) — a functional WebGL wrapper. Use for custom draw commands with full control over vertices, buffers, elements, blend modes, multi-pass rendering, and geometry.

Sits between the high-level glsl node (fragment shader only) and building a full custom renderer. You get direct access to the regl instance and input textures as regl textures (zero copy).

**regl-specific globals:**
- regl: The regl instance (shared with the rendering pipeline)
- width, height: Output framebuffer dimensions

**regl-specific methods:**
- setVideoCount(inlets, outlets) - Configure video inlets/outlets (default 1, 1)
- getTexture(index) - Get regl Texture2D from video inlet (0-based index, returns null if not connected)
- noDrag(), noPan(), noWheel(), noInteract() - Interaction control
- noOutput() - Hide video output port

**regl-specific gotchas:**
- CRITICAL: Every regl draw command MUST include vert, frag, attributes, and count. Omitting vert causes "(regl) missing vertex shader" errors. Always use the fullscreen quad boilerplate below.
- Use render(time) function for the render loop — it's called every frame automatically
- The output framebuffer is already bound when render() is called — just draw directly
- regl.clear() auto-injects the output framebuffer if you omit the framebuffer key
- All regl resources (buffers, textures, elements, draw commands) are automatically cleaned up on code reload or node deletion — no manual cleanup needed
- Runs in web worker — no direct DOM access

**Fullscreen quad boilerplate** — use this for any 2D effect:
\`\`\`js
await regl({
  vert: \\\`
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0, 1);
    }
  \\\`,
  frag: \\\`/* your fragment shader */\\\`,
  attributes: { position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]] },
  count: 6,
  depth: { enable: false },
})
\`\`\`

**Font & element sizes:**
- The node is displayed very zoomed out in the patch canvas. Use large font sizes and shapes.

${fftInstructions}

**Render Pattern:**
Define a \`render(time)\` function that will be called every frame:
\`\`\`js
function render(time) {
  regl.clear({ color: [0, 0, 0, 1] })
  draw({ time })
}
\`\`\`

Example - Fullscreen color gradient:
\`\`\`json
{
  "type": "regl",
  "data": {
    "code": "const draw = await regl({\\n  vert: \`\\n    precision mediump float;\\n    attribute vec2 position;\\n    varying vec2 uv;\\n    void main() {\\n      uv = position * 0.5 + 0.5;\\n      gl_Position = vec4(position, 0, 1);\\n    }\\n  \`,\\n  frag: \`\\n    precision mediump float;\\n    varying vec2 uv;\\n    uniform float time;\\n    void main() {\\n      gl_FragColor = vec4(\\n        sin(uv.x * 6.28 + time) * 0.5 + 0.5,\\n        sin(uv.y * 6.28 + time * 1.3) * 0.5 + 0.5,\\n        sin((uv.x + uv.y) * 3.14 + time * 0.7) * 0.5 + 0.5,\\n        1.0\\n      );\\n    }\\n  \`,\\n  attributes: {\\n    position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]]\\n  },\\n  uniforms: {\\n    time: regl.prop('time'),\\n  },\\n  count: 6,\\n  depth: { enable: false },\\n})\\n\\nfunction render(time) {\\n  regl.clear({ color: [0, 0, 0, 1] })\\n  draw({ time })\\n}"
  }
}
\`\`\`

Example - Video texture mixer (2 inputs):
\`\`\`json
{
  "type": "regl",
  "data": {
    "code": "setVideoCount(2, 1)\\n\\nconst draw = await regl({\\n  vert: \`\\n    precision mediump float;\\n    attribute vec2 position;\\n    varying vec2 uv;\\n    void main() {\\n      uv = position * 0.5 + 0.5;\\n      gl_Position = vec4(position, 0, 1);\\n    }\\n  \`,\\n  frag: \`\\n    precision mediump float;\\n    varying vec2 uv;\\n    uniform sampler2D tex0;\\n    uniform sampler2D tex1;\\n    uniform float time;\\n    void main() {\\n      vec4 a = texture2D(tex0, uv);\\n      vec4 b = texture2D(tex1, uv);\\n      gl_FragColor = mix(a, b, sin(time) * 0.5 + 0.5);\\n    }\\n  \`,\\n  attributes: {\\n    position: [[-1,-1], [1,-1], [-1,1], [-1,1], [1,-1], [1,1]]\\n  },\\n  uniforms: {\\n    tex0: () => getTexture(0),\\n    tex1: () => getTexture(1),\\n    time: regl.prop('time'),\\n  },\\n  count: 6,\\n  depth: { enable: false },\\n})\\n\\nfunction render(time) {\\n  regl.clear({ color: [0, 0, 0, 0] })\\n  draw({ time })\\n}"
  }
}
\`\`\``;
