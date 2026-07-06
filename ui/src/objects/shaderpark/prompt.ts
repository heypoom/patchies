export const shaderparkPrompt = `## shaderpark Object Instructions

Shader Park Sculpt code for SDF/raymarched visuals. Write Sculpt statements, not GLSL shaders, Three.js scenes, or Patchies JS runtime APIs like send/recv/settings.

Use // @title Name and optional // @primaryButton code|settings|run. input()/input2D() create persistent settings and message inlets; those inlets also accept run/setCode. Video inputs are sampler2D uniforms iChannel0..iChannel3, usually sampled from a glslFunc/glslFuncES3 helper.

Built-ins: time: float seconds, mouse: vec3, getSpace(): vec3 current sample position, getRayDirection(): vec3, normal: vec3 in material code.

Useful Sculpt API:
- Geometry: sphere(r: float), box(size: vec3 | x,y,z), torus(size: vec2 | major,minor), cylinder(size: vec2 | r,h), cone(size: vec2), plane(x,y,z,w), line(a: vec3,b: vec3,r), roundCone(a: vec3,b: vec3,r1,r2), boxFrame/link/cappedTorus(...)
- CSG/state: union(), difference(), intersect(), blend(k), mixGeo(t), shape(() => {...}), setSDF(d), reset()
- Space ops: getSpace(), setSpace(p: vec3), displace(x,y,z), repeat(s: float|vec3), rotateX/Y/Z(radians), mirrorX/Y/Z(), mirrorXYZ(), flipX/Y/Z(), expand(k), shell(thickness)
- Material/render: color(vec3|r,g,b), shine(k), metal(k), lightDirection(x,y,z), backgroundColor(r,g,b), noLighting(), occlusion(k), setStepSize(k), setMaxIterations(n), setGeometryQuality(k)
- Inputs/coords: input(value,min?,max?) -> float, input2D(x,y), vec2/vec3/vec4(...), mouseIntersection(): vec3, getPixelCoord(): vec2, getResolution(): vec2, get2DCoords(): vec2, enable2D(), getSpherical(): vec3
- Math unary same-shape: sin cos tan asin acos exp log exp2 log2 sqrt inversesqrt abs sign floor ceil fract all take float|vecN and return same shape. Angles are radians.
- Math scalar: nsin/ncos/round/osc(float)->float, mod/min/max/atan(float,float)->float, clamp/smoothstep(float,float,float)->float.
- Math vector: length(vec3)->float, distance/dot(vec3,vec3)->float, cross/reflect/refract(vec3,vec3)->vec3, normalize(vec3)->vec3.
- Other math: mix(a:T,b:T,amount:float|T)->T; pow(base:T,exp:T)->T; hsv2rgb/rgb2hsv(vec3)->vec3; rotateVec(v:vec3,axis:vec3,angle)->vec3; noise/fractalNoise(vec3)->float.
- GLSL extension: glslFunc(\`float f(vec3 p){...}\`), glslFuncES3(\`...\`), glslSDF(\`float f(vec3 p){...}\`).

Example - Simple Sphere:
\`\`\`json
{
  "type": "shaderpark",
  "data": {
    "code": "// @title Simple Sphere\\ncolor(vec3(0.2, 0.6, 1.0));\\nshine(0.6);\\nrotateY(time * 0.5);\\nsphere(0.35);"
  }
}
\`\`\`

Example - Animated Field:
\`\`\`json
{
  "type": "shaderpark",
  "data": {
    "code": "let p = getSpace();\\nmetal(0.2);\\nshine(0.7);\\ncolor(hsv2rgb(vec3(0.55 + p.y * 0.2, 0.8, 1.0)));\\nsphere(0.25 + 0.08 * sin(time + p.x * 8.0));"
  }
}
\`\`\``;
