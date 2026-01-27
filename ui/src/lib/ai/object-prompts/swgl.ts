export const swglPrompt = `## swgl Object Instructions

SwissGL - WebGL2 wrapper for concise shaders. Must implement \`render({ t })\` function.

## Parameters

**Shaders:**
- \`VP\`: Vertex shader (shorthand \`x,y,z,w\` or multiline with \`VPos = vec4(...)\`)
- \`FP\`: Fragment shader (shorthand \`r,g,b,a\` or multiline with \`FOut = vec4(...)\`)
- \`Inc\`: Shared code included in both VP and FP

**Geometry:**
- \`Mesh: [w, h]\`: Tessellated plane (default [1,1])
- \`Grid: [w, h, d]\`: Instance grid for multiple copies (access via \`ID\`)

**Rendering:**
- \`Clear: [r, g, b, a]\`: Clear color before drawing
- \`Blend: 's+d'\`: Blend expression (\`s\`=source, \`d\`=dest, \`sa\`/\`da\`=alphas)
- \`DepthTest: true\`: Enable depth test (\`true\`, \`false\`, \`'keep'\`)
- \`Face: 'back'\`: Cull faces (\`'front'\` or \`'back'\`)
- \`Aspect: 'fit'\`: Coord scaling (\`'fit'\`, \`'cover'\`, \`'mean'\`, \`'x'\`, \`'y'\`)
- \`View: [x, y, w, h]\`: Viewport specification

**Textures/Buffers:**
- \`tag: 'name'\`: Cache buffer for reuse
- \`story: N\`: Frame history (N rotating textures, previous as \`Src\`)
- \`size: [w, h]\`: Texture dimensions
- \`format\`: \`'rgba8'\`, \`'rgba16f'\`, \`'rgba32f'\`, \`'r8'\`, \`'r16f'\`, \`'r32f'\`
- \`filter: 'linear'\`: Texture filter (\`'nearest'\` or \`'linear'\`)
- \`wrap: 'repeat'\`: Texture wrap (\`'repeat'\`, \`'edge'\`, \`'mirror'\`)

## Variables

**Vertex Shader:**
- \`XY\`: vec2 in [-1, 1] range
- \`UV\`: vec2 in [0, 1] range
- \`VID\`: ivec2 vertex index
- \`ID\`: ivec3 instance ID (when using Grid)
- \`Mesh\`, \`Grid\`: ivec dimension uniforms
- \`VPos\`: vec4 output position (required in multiline VP)

**Fragment Shader:**
- \`I\`: ivec2 pixel coordinates
- \`FOut\`: vec4 output color (required in multiline FP)

**Texture Sampling:**
- \`Src(I)\`: Sample previous frame (with \`story\`)
- \`textureName(ivec2)\`: texelFetch (integer coords)
- \`textureName(vec2)\`: filtered lookup (float coords)

**Constants:** \`TAU\` (2π), \`PI\` (π)

**Varyings:** Declare \`varying vec3 v = value;\` in VP, use \`v\` in FP

## Examples

### Simple Fragment
\`\`\`javascript
function render({ t }) {
  glsl({ t, FP: \\\`vec3(sin(t+XY.x*5.0), cos(t+XY.y*3.0), 0.5),1\\\` });
}
\`\`\`

### 3D Mesh with Lighting
\`\`\`javascript
function render({ t }) {
  glsl({
    t, Mesh: [40, 20], Clear: [0, 0, 0, 1],
    VP: \\\`
      vec2 ang = XY * vec2(TAU, TAU/2.0);
      vec3 pos = vec3(cos(ang.x)*cos(ang.y), sin(ang.y), sin(ang.x)*cos(ang.y)) * 0.6;
      float s = sin(t*0.5), c = cos(t*0.5);
      pos.xz = mat2(c, s, -s, c) * pos.xz;
      varying vec3 vPos = pos;
      VPos = vec4(pos, 1.0);\\\`,
    FP: \\\`
      vec3 n = normalize(vPos);
      float light = dot(n, normalize(vec3(1,1,0.5))) * 0.5 + 0.5;
      FOut = vec4(vec3(0.4, 0.6, 1.0) * light, 1.0);\\\`
  });
}
\`\`\`

### Feedback Trail (using story)
\`\`\`javascript
function render({ t }) {
  glsl({
    t, story: 2, tag: 'trail',
    FP: \\\`
      vec3 col = Src(I).rgb * 0.98;
      float d = length(XY*0.5 - 0.3*vec2(cos(t), sin(t)));
      col += vec3(1, 0.5, 0.2) * smoothstep(0.1, 0.0, d);
      FOut = vec4(col, 1);\\\`
  });
  glsl({ tag: 'trail', FP: 'Src(I)' });
}
\`\`\`

HANDLE IDS: inlet "message-in-0", outlet "video-out-0"`;
