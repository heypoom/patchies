import {
  CompletionContext as CMCompletionContext,
  type Completion
} from '@codemirror/autocomplete';
import { isCompletionSuppressedByComment } from '$lib/codemirror/completion-utils';
import type { PatchiesContext } from '$lib/codemirror/patchies-completions';

const SHADERPARK_NODE_TYPE = 'shaderpark';

const shaderParkCompletionInfo: Record<string, string> = {
  union: 'Combine following geometry by union.',
  difference: 'Subtract following geometry from the shape.',
  intersect: 'Keep only overlapping geometry.',
  blend: 'Softly blend the next geometry operation.',
  mixGeo: 'Mix between geometry operations.',
  getSpace: 'Read the current transformed 3D space.',
  getSDF: 'Read the current signed-distance value.',
  shape: 'Group geometry in a nested shape callback.',
  setSDF: 'Set the current signed-distance value.',
  extractSDF: 'Wrap a primitive so it returns its SDF instead of applying it.',
  reset: 'Reset the current shape state.',
  displace: 'Move the current space by x, y, z.',
  setSpace: 'Replace the current transformed space.',
  repeat: 'Repeat space at a regular interval.',
  repeatLinear: 'Repeat space on a bounded 3D grid.',
  repeatRadial: 'Repeat space radially around the Y axis.',
  rotateX: 'Rotate space around the X axis.',
  rotateY: 'Rotate space around the Y axis.',
  rotateZ: 'Rotate space around the Z axis.',
  overwrite: 'Replace the current SDF with following geometry.',
  mirrorN: 'Mirror space repeatedly across all axes.',
  grid: 'Add a mirrored box-frame grid.',
  scaleShape: 'Wrap a primitive so it renders at a scaled size.',
  revolve2D: 'Wrap a 2D SDF as a surface of revolution.',
  extrude2D: 'Wrap a 2D SDF as an extruded 3D shape.',
  mirrorX: 'Mirror space across the X axis.',
  mirrorY: 'Mirror space across the Y axis.',
  mirrorZ: 'Mirror space across the Z axis.',
  mirrorXYZ: 'Mirror space across all axes.',
  flipX: 'Flip space along the X axis.',
  flipY: 'Flip space along the Y axis.',
  flipZ: 'Flip space along the Z axis.',
  expand: 'Expand or shrink the current SDF.',
  shell: 'Turn the current SDF into a shell.',
  color: 'Set the material color.',
  reflectiveColor: 'Set reflected material color.',
  metal: 'Set material metallic amount.',
  shine: 'Set material shine or roughness.',
  fresnel: 'Compute a view-angle Fresnel falloff.',
  lightDirection: 'Set the scene light direction.',
  backgroundColor: 'Set the render background color.',
  noLighting: 'Render material color without lighting.',
  occlusion: 'Set ambient occlusion amount.',
  setStepSize: 'Set raymarching step size.',
  setGeometryQuality: 'Set geometry quality multiplier.',
  setMaxIterations: 'Set raymarching iteration limit.',
  setMaxReflections: 'Set reflection bounce limit.',
  input: 'Create a persistent numeric setting.',
  input2D: 'Create a persistent 2D setting.',
  vec2: 'Create a two-component vector.',
  vec3: 'Create a three-component vector.',
  vec4: 'Create a four-component vector.',
  mouseIntersection: 'Get the ray intersection from mouse input.',
  getRayDirection: 'Get the current ray direction.',
  getPixelCoord: 'Get the current pixel coordinate.',
  getResolution: 'Get the current render resolution.',
  get2DCoords: 'Get normalized 2D coordinates.',
  enable2D: 'Switch the sculpture to 2D coordinates.',
  getSpherical: 'Read the current space in spherical coordinates.',
  glslFunc: 'Bind a GLSL helper function.',
  glslFuncES3: 'Bind a GLSL ES 3 helper function.',
  glslSDF: 'Bind a GLSL SDF helper.',
  mix: 'Linearly interpolate between matching values.',
  nsin: 'Sine mapped from -1..1 into 0..1.',
  ncos: 'Cosine mapped from -1..1 into 0..1.',
  round: 'Round a float value.',
  hsv2rgb: 'Convert HSV color to RGB.',
  rgb2hsv: 'Convert RGB color to HSV.',
  rotateVec: 'Rotate a vector around an axis.',
  toSpherical: 'Convert a vector to spherical coordinates.',
  fromSpherical: 'Convert spherical coordinates to a vector.',
  osc: 'Oscillator mapped from time-like input.',
  _hash33: 'Hash a vec3 to a vec3.',
  _hash13: 'Hash a vec3 to a float.',
  noise: 'Sample Shader Park noise.',
  fractalNoise: 'Sample layered Shader Park noise.',
  sphericalDistribution: 'Generate a spherical distribution vector.',
  vectorContourNoise: 'Generate contour-like vector noise from repeated noise samples.',
  sin: 'Sine of an angle in radians.',
  cos: 'Cosine of an angle in radians.',
  tan: 'Tangent of an angle in radians.',
  asin: 'Inverse sine, returning radians.',
  acos: 'Inverse cosine, returning radians.',
  exp: 'Raise e to the input value.',
  log: 'Natural logarithm.',
  exp2: 'Raise 2 to the input value.',
  log2: 'Base-2 logarithm.',
  sqrt: 'Square root.',
  inversesqrt: 'Reciprocal square root.',
  abs: 'Absolute value.',
  sign: 'Return -1, 0, or 1 from the sign of x.',
  floor: 'Largest integer not greater than x.',
  ceil: 'Smallest integer not less than x.',
  fract: 'Fractional part of x.',
  pow: 'Raise base to exponent; dimensions must match.',
  mod: 'Remainder after division.',
  min: 'Smaller of two scalar values.',
  max: 'Larger of two scalar values.',
  atan: 'Arctangent from y and x, returning radians.',
  clamp: 'Constrain x between min and max.',
  step: 'Return 0 below edge, otherwise 1.',
  smoothstep: 'Smooth Hermite interpolation between two edges.',
  length: 'Vector magnitude.',
  distance: 'Distance between two points.',
  dot: 'Dot product of two vectors.',
  cross: 'Cross product of two vec3 values.',
  normalize: 'Scale a vector to unit length.',
  reflect: 'Reflect an incident vector around a normal.',
  refract: 'Refract an incident vector through a surface normal.'
};

const shaderParkCompletionDetails: Record<string, string> = {
  sin: '(x: float | vecN) => same',
  cos: '(x: float | vecN) => same',
  tan: '(x: float | vecN) => same',
  asin: '(x: float | vecN) => same',
  acos: '(x: float | vecN) => same',
  nsin: '(x: float) => float',
  exp: '(x: float | vecN) => same',
  log: '(x: float | vecN) => same',
  exp2: '(x: float | vecN) => same',
  log2: '(x: float | vecN) => same',
  pow: '(base: T, exponent: T) => T',
  sqrt: '(x: float | vecN) => same',
  inversesqrt: '(x: float | vecN) => same',
  mod: '(x: float, y: float) => float',
  fract: '(x: float | vecN) => same',
  abs: '(x: float | vecN) => same',
  sign: '(x: float | vecN) => same',
  floor: '(x: float | vecN) => same',
  ceil: '(x: float | vecN) => same',
  min: '(a: float, b: float) => float',
  max: '(a: float, b: float) => float',
  atan: '(y: float, x: float) => float',
  clamp: '(x: float, min: float, max: float) => float',
  step: '(edge: float, x: float) => float',
  mix: '(a: T, b: T, amount: float | T) => T',
  smoothstep: '(edge0: float, edge1: float, x: float) => float',
  length: '(v: vec3) => float',
  distance: '(a: vec3, b: vec3) => float',
  dot: '(a: vec3, b: vec3) => float',
  cross: '(a: vec3, b: vec3) => vec3',
  normalize: '(v: vec3) => vec3',
  reflect: '(incident: vec3, normal: vec3) => vec3',
  refract: '(incident: vec3, normal: vec3) => vec3'
};

const rawShaderParkCompletions: Completion[] = [
  { label: 'time', type: 'variable', detail: 'float', info: 'Elapsed Shader Park time.' },
  {
    label: 'mouse',
    type: 'variable',
    detail: 'vec3',
    info: 'Normalized Shader Park mouse coordinates.'
  },
  { label: 'opacity', type: 'variable', detail: 'float', info: 'Output opacity uniform.' },
  { label: 'stepSize', type: 'variable', detail: 'float', info: 'Raymarching step size uniform.' },
  { label: 'resolution', type: 'variable', detail: 'vec2', info: 'Render resolution uniform.' },
  { label: 'PI', type: 'constant', detail: 'float', info: 'Pi constant.' },
  { label: 'TWO_PI', type: 'constant', detail: 'float', info: 'Two pi constant.' },
  { label: 'TAU', type: 'constant', detail: 'float', info: 'Tau constant.' },
  {
    label: 'iChannel0',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 0 when referenced from GLSL helper code.'
  },
  {
    label: 'iChannel1',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 1 when referenced from GLSL helper code.'
  },
  {
    label: 'iChannel2',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 2 when referenced from GLSL helper code.'
  },
  {
    label: 'iChannel3',
    type: 'variable',
    detail: 'sampler2D',
    info: 'Texture from video inlet 3 when referenced from GLSL helper code.'
  },
  {
    label: 'sphere',
    type: 'function',
    detail: '(radius: float) => void',
    info: 'Add a sphere SDF to the current shape.',
    apply: 'sphere(0.5)'
  },
  {
    label: 'line',
    type: 'function',
    detail: '(a: vec3, b: vec3, radius: float) => void',
    info: 'Add a rounded line segment between two points.',
    apply: 'line(vec3(-0.5, 0, 0), vec3(0.5, 0, 0), 0.05)'
  },
  {
    label: 'cone',
    type: 'function',
    detail: '(size: vec2) => void',
    info: 'Add a cone SDF.',
    apply: 'cone(vec2(0.5, 1.0))'
  },
  {
    label: 'roundCone',
    type: 'function',
    detail: '(a: vec3, b: vec3, r1: float, r2: float) => void',
    info: 'Add a rounded cone between two points.',
    apply: 'roundCone(vec3(0, -0.5, 0), vec3(0, 0.5, 0), 0.3, 0.1)'
  },
  {
    label: 'plane',
    type: 'function',
    detail: '(x: float, y: float, z: float, w: float) => void',
    info: 'Add a plane SDF.',
    apply: 'plane(0, 1, 0, 0)'
  },
  {
    label: 'box',
    type: 'function',
    detail: '(size: vec3) => void',
    info: 'Add a box SDF. Also accepts x, y, z scalar sizes.',
    apply: 'box(vec3(0.5))'
  },
  {
    label: 'torus',
    type: 'function',
    detail: '(size: vec2) => void',
    info: 'Add a torus SDF. Also accepts major and minor scalar radii.',
    apply: 'torus(vec2(0.5, 0.1))'
  },
  {
    label: 'cylinder',
    type: 'function',
    detail: '(size: vec2) => void',
    info: 'Add a cylinder SDF. Also accepts radius and height scalar values.',
    apply: 'cylinder(vec2(0.35, 1.0))'
  },
  {
    label: 'boxFrame',
    type: 'function',
    detail: '(size: vec3, edge: float) => void',
    info: 'Add a hollow box frame with the given half-size and edge thickness.',
    apply: 'boxFrame(vec3(0.5), 0.05)'
  },
  {
    label: 'link',
    type: 'function',
    detail: '(length: float, radius: float, thickness: float) => void',
    info: 'Add a chain-link shape stretched along Y, with ring radius and tube thickness.',
    apply: 'link(0.35, 0.35, 0.08)'
  },
  {
    label: 'cappedTorus',
    type: 'function',
    detail: '(cap: vec2, radius: float, thickness: float) => void',
    info: 'Add a torus arc capped by a direction vector, radius, and tube thickness.',
    apply: 'cappedTorus(vec2(0.8, 0.6), 0.5, 0.08)'
  },
  { label: 'union', type: 'function', detail: '() => void', apply: 'union()' },
  { label: 'difference', type: 'function', detail: '() => void', apply: 'difference()' },
  { label: 'intersect', type: 'function', detail: '() => void', apply: 'intersect()' },
  { label: 'blend', type: 'function', detail: '(amount: float) => void', apply: 'blend(0.2)' },
  { label: 'mixGeo', type: 'function', detail: '(amount: float) => void', apply: 'mixGeo(0.5)' },
  { label: 'overwrite', type: 'function', detail: '() => void', apply: 'overwrite()' },
  { label: 'getSpace', type: 'function', detail: '() => vec3', apply: 'getSpace()' },
  { label: 'getSDF', type: 'function', detail: '() => float', apply: 'getSDF()' },
  {
    label: 'shape',
    type: 'function',
    detail: '(callback: () => void) => void',
    apply: 'shape(() => {\n  \n})'
  },
  { label: 'setSDF', type: 'function', detail: '(sdf: float) => void', apply: 'setSDF()' },
  {
    label: 'extractSDF',
    type: 'function',
    detail: '(primitive: (...args) => void) => (...args) => float',
    apply: 'extractSDF(sphere)'
  },
  { label: 'reset', type: 'function', detail: '() => void', apply: 'reset()' },
  {
    label: 'displace',
    type: 'function',
    detail: '(x: float, y: float, z: float) => void',
    apply: 'displace(0, 0, 0)'
  },
  { label: 'setSpace', type: 'function', detail: '(space: vec3) => void', apply: 'setSpace()' },
  {
    label: 'repeat',
    type: 'function',
    detail: '(spacing: float | vec3, repetitions: float | vec3) => void',
    apply: 'repeat(1.0, 3)'
  },
  {
    label: 'repeatLinear',
    type: 'function',
    detail: '(scale: vec3, spacing: vec3, counts: vec3) => { index: vec3, local: vec3 }',
    apply: 'repeatLinear(vec3(0.4), vec3(1.2), vec3(3))'
  },
  {
    label: 'repeatRadial',
    type: 'function',
    detail: '(repeats: float) => float',
    apply: 'repeatRadial(8)'
  },
  { label: 'rotateX', type: 'function', detail: '(angle: float) => void', apply: 'rotateX(time)' },
  { label: 'rotateY', type: 'function', detail: '(angle: float) => void', apply: 'rotateY(time)' },
  { label: 'rotateZ', type: 'function', detail: '(angle: float) => void', apply: 'rotateZ(time)' },
  { label: 'mirrorX', type: 'function', detail: '() => void', apply: 'mirrorX()' },
  { label: 'mirrorY', type: 'function', detail: '() => void', apply: 'mirrorY()' },
  { label: 'mirrorZ', type: 'function', detail: '() => void', apply: 'mirrorZ()' },
  { label: 'mirrorXYZ', type: 'function', detail: '() => void', apply: 'mirrorXYZ()' },
  { label: 'flipX', type: 'function', detail: '() => void', apply: 'flipX()' },
  { label: 'flipY', type: 'function', detail: '() => void', apply: 'flipY()' },
  { label: 'flipZ', type: 'function', detail: '() => void', apply: 'flipZ()' },
  {
    label: 'mirrorN',
    type: 'function',
    detail: '(iterations: number, scale: float) => void',
    apply: 'mirrorN(3, 0.4)'
  },
  {
    label: 'grid',
    type: 'function',
    detail: '(num?: number, scale?: float, roundness?: float) => void',
    apply: 'grid(3, 0.2, 0.05)'
  },
  { label: 'expand', type: 'function', detail: '(amount: float) => void', apply: 'expand(0.1)' },
  { label: 'shell', type: 'function', detail: '(thickness: float) => void', apply: 'shell(0.05)' },
  {
    label: 'scaleShape',
    type: 'function',
    detail: '(primitive: (...args) => void, factor: float) => (...args) => void',
    apply: 'scaleShape(sphere, 1.5)'
  },
  {
    label: 'revolve2D',
    type: 'function',
    detail: '(sdf2D: (...args) => float) => (radius: float, ...args) => void',
    apply: 'revolve2D()'
  },
  {
    label: 'extrude2D',
    type: 'function',
    detail: '(sdf2D: (...args) => float) => (height: float, ...args) => void',
    apply: 'extrude2D()'
  },
  {
    label: 'color',
    type: 'function',
    detail: '(r: float, g: float, b: float) => void',
    apply: 'color(1, 1, 1)'
  },
  {
    label: 'reflectiveColor',
    type: 'function',
    detail: '(color: vec3 | r: float, g?: float, b?: float) => void',
    apply: 'reflectiveColor(vec3(1, 1, 1))'
  },
  { label: 'metal', type: 'function', detail: '(amount: float) => void', apply: 'metal(0.5)' },
  { label: 'shine', type: 'function', detail: '(amount: float) => void', apply: 'shine(0.8)' },
  { label: 'fresnel', type: 'function', detail: '(power: float) => float', apply: 'fresnel(3)' },
  {
    label: 'lightDirection',
    type: 'function',
    detail: '(x: float, y: float, z: float) => void',
    apply: 'lightDirection(0, 1, 0)'
  },
  {
    label: 'backgroundColor',
    type: 'function',
    detail: '(r: float, g: float, b: float) => void',
    apply: 'backgroundColor(0, 0, 0)'
  },
  { label: 'noLighting', type: 'function', detail: '() => void', apply: 'noLighting()' },
  {
    label: 'occlusion',
    type: 'function',
    detail: '(amount: float) => void',
    apply: 'occlusion(0.5)'
  },
  {
    label: 'setStepSize',
    type: 'function',
    detail: '(size: float) => void',
    apply: 'setStepSize(0.85)'
  },
  {
    label: 'setGeometryQuality',
    type: 'function',
    detail: '(quality: float) => void',
    apply: 'setGeometryQuality(1)'
  },
  {
    label: 'setMaxIterations',
    type: 'function',
    detail: '(count: number) => void',
    apply: 'setMaxIterations(300)'
  },
  {
    label: 'setMaxReflections',
    type: 'function',
    detail: '(count: number) => void',
    apply: 'setMaxReflections(2)'
  },
  {
    label: 'input',
    type: 'function',
    detail: '(value: number, min?: number, max?: number) => number',
    apply: 'input(0.5, 0, 1)'
  },
  {
    label: 'input2D',
    type: 'function',
    detail: '(x: number, y: number) => vec2-like setting',
    apply: 'input2D(0, 0)'
  },
  { label: 'vec2', type: 'function', detail: '(x: float, y?: float) => vec2', apply: 'vec2(0)' },
  {
    label: 'vec3',
    type: 'function',
    detail: '(x: float, y?: float, z?: float) => vec3',
    apply: 'vec3(0)'
  },
  {
    label: 'vec4',
    type: 'function',
    detail: '(x: float, y?: float, z?: float, w?: float) => vec4',
    apply: 'vec4(0)'
  },
  {
    label: 'mouseIntersection',
    type: 'function',
    detail: '() => vec3',
    apply: 'mouseIntersection()'
  },
  { label: 'getRayDirection', type: 'function', detail: '() => vec3', apply: 'getRayDirection()' },
  { label: 'getPixelCoord', type: 'function', detail: '() => vec2', apply: 'getPixelCoord()' },
  { label: 'getResolution', type: 'function', detail: '() => vec2', apply: 'getResolution()' },
  { label: 'get2DCoords', type: 'function', detail: '() => vec2', apply: 'get2DCoords()' },
  { label: 'enable2D', type: 'function', detail: '() => void', apply: 'enable2D()' },
  { label: 'getSpherical', type: 'function', detail: '() => vec3', apply: 'getSpherical()' },
  {
    label: 'glslFunc',
    type: 'function',
    detail: '(source: string) => Function',
    apply: 'glslFunc(`\n\n`)'
  },
  {
    label: 'glslFuncES3',
    type: 'function',
    detail: '(source: string) => Function',
    apply: 'glslFuncES3(`\n\n`)'
  },
  {
    label: 'glslSDF',
    type: 'function',
    detail: '(source: string) => Function',
    apply: 'glslSDF(`\n\n`)'
  },
  { label: 'mix', type: 'function', detail: '(a, b, amount) => value', apply: 'mix(0, 1, 0.5)' },
  { label: 'nsin', type: 'function', detail: '(value: float) => float', apply: 'nsin(time)' },
  { label: 'ncos', type: 'function', detail: '(value: float) => float', apply: 'ncos(time)' },
  { label: 'round', type: 'function', detail: '(value: float) => float', apply: 'round()' },
  {
    label: 'hsv2rgb',
    type: 'function',
    detail: '(color: vec3) => vec3',
    apply: 'hsv2rgb(vec3(0, 1, 1))'
  },
  {
    label: 'rgb2hsv',
    type: 'function',
    detail: '(color: vec3) => vec3',
    apply: 'rgb2hsv(vec3(1, 1, 1))'
  },
  {
    label: 'rotateVec',
    type: 'function',
    detail: '(value: vec3, axis: vec3, angle: float) => vec3',
    apply: 'rotateVec(getSpace(), vec3(0, 1, 0), time)'
  },
  {
    label: 'toSpherical',
    type: 'function',
    detail: '(value: vec3) => vec3',
    apply: 'toSpherical(getSpace())'
  },
  {
    label: 'fromSpherical',
    type: 'function',
    detail: '(value: vec3) => vec3',
    apply: 'fromSpherical()'
  },
  { label: 'osc', type: 'function', detail: '(value: float) => float', apply: 'osc(time)' },
  {
    label: '_hash33',
    type: 'function',
    detail: '(value: vec3) => vec3',
    apply: '_hash33(getSpace())'
  },
  {
    label: '_hash13',
    type: 'function',
    detail: '(value: vec3) => float',
    apply: '_hash13(getSpace())'
  },
  {
    label: 'noise',
    type: 'function',
    detail: '(value: vec3) => float',
    apply: 'noise(getSpace())'
  },
  {
    label: 'fractalNoise',
    type: 'function',
    detail: '(value: vec3) => float',
    apply: 'fractalNoise(getSpace())'
  },
  {
    label: 'sphericalDistribution',
    type: 'function',
    detail: '(value: vec3, amount: float) => vec4',
    apply: 'sphericalDistribution(getSpace(), 1)'
  },
  {
    label: 'vectorContourNoise',
    type: 'function',
    detail: '(space: vec3, offset: float, sinScale?: float) => vec3',
    apply: 'vectorContourNoise(getSpace(), time, 1)'
  },
  ...[
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'exp',
    'log',
    'exp2',
    'log2',
    'sqrt',
    'inversesqrt',
    'abs',
    'sign',
    'floor',
    'ceil',
    'fract',
    'pow',
    'mod',
    'min',
    'max',
    'atan',
    'clamp',
    'step',
    'smoothstep',
    'length',
    'distance',
    'dot',
    'cross',
    'normalize',
    'reflect',
    'refract'
  ].map((label) => ({
    label,
    type: 'function',
    detail: 'GLSL-style math helper',
    apply: `${label}()`
  }))
];

const shaderParkCompletions: Completion[] = rawShaderParkCompletions.map((completion) => ({
  ...completion,
  detail: shaderParkCompletionDetails[completion.label] ?? completion.detail,
  info:
    completion.info ?? shaderParkCompletionInfo[completion.label] ?? 'Shader Park Sculpt helper.'
}));

function isValueReturningFunctionCompletion(completion: Completion): boolean {
  return completion.type === 'function' && !completion.detail?.includes('=> void');
}

function isExpressionCompletionPosition(context: CMCompletionContext, from: number): boolean {
  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = line.text.slice(0, from - line.from);
  const trimmedPrefix = linePrefix.trimEnd();

  if (!trimmedPrefix) return false;

  return (
    /[=([,{?:+\-*/%&|^!<>]$/.test(trimmedPrefix) ||
    /(?:^|[^\w$])(?:return|throw|yield|typeof|void|delete|new)\s+$/.test(linePrefix)
  );
}

export function createShaderParkCompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CMCompletionContext) => {
    if (patchiesContext?.nodeType !== SHADERPARK_NODE_TYPE) return null;

    const word = context.matchBefore(/[A-Za-z_$][\w$]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    if (isCompletionSuppressedByComment(context, word.from)) return null;

    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();
    const isExpressionPosition = isExpressionCompletionPosition(context, word.from);
    const options = shaderParkCompletions.filter(
      (completion) =>
        (!typedText || completion.label.toLowerCase().startsWith(typedText)) &&
        (isExpressionPosition || !isValueReturningFunctionCompletion(completion))
    );

    return {
      from: word.from,
      options,
      validFor: /^[A-Za-z_$][\w$]*$/
    };
  };
}

export const shaderParkCompletionsSource = (context?: PatchiesContext) =>
  createShaderParkCompletionSource(context);
