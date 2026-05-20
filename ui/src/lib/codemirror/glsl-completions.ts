import {
  CompletionContext as CMCompletionContext,
  type Completion,
  snippetCompletion
} from '@codemirror/autocomplete';
import { isCompletionSuppressedByComment } from '$lib/codemirror/completion-utils';

const statementCompletions: Completion[] = [
  ...[
    ['void', 'No return value.'],
    ['bool', 'Boolean scalar.'],
    ['int', 'Signed integer scalar.'],
    ['uint', 'Unsigned integer scalar.'],
    ['float', 'Floating-point scalar.'],
    ['vec2', 'Two-component float vector.'],
    ['vec3', 'Three-component float vector.'],
    ['vec4', 'Four-component float vector.'],
    ['ivec2', 'Two-component integer vector.'],
    ['ivec3', 'Three-component integer vector.'],
    ['ivec4', 'Four-component integer vector.'],
    ['mat2', '2x2 float matrix.'],
    ['mat3', '3x3 float matrix.'],
    ['mat4', '4x4 float matrix.']
  ].map(([label, info]) => ({
    label,
    type: 'type',
    info
  })),
  snippetCompletion('mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  ${body}\n}', {
    label: 'mainImage',
    type: 'function',
    detail: '(out vec4 fragColor, in vec2 fragCoord) => void',
    info: 'Patchies/Shadertoy fragment entry point.'
  }),
  snippetCompletion('mainImage(vec2 fragCoord) {\n  ${body}\n}', {
    label: 'mainImage MRT',
    type: 'function',
    detail: '(vec2 fragCoord) => void',
    info: 'Patchies multi-output entry point. Write to layout(location) outputs directly.'
  }),
  snippetCompletion('uniform float ${name};', {
    label: 'float uniform',
    type: 'keyword',
    detail: 'declare numeric inlet',
    info: 'Declare a float uniform. Patchies creates a message inlet for it.'
  }),
  snippetCompletion('uniform vec2 ${name};', {
    label: 'vec2 uniform',
    type: 'keyword',
    detail: 'declare vec2 inlet',
    info: 'Declare a vec2 uniform. Patchies accepts two-number array messages.'
  }),
  snippetCompletion('uniform vec3 ${name};', {
    label: 'vec3 uniform',
    type: 'keyword',
    detail: 'declare vec3 inlet',
    info: 'Declare a vec3 uniform. Can be paired with a color @param directive.'
  }),
  snippetCompletion('uniform vec2 ${name}[${4}];', {
    label: 'vec2 array uniform',
    type: 'keyword',
    detail: 'declare vec2 array inlet',
    info: 'Declare an array uniform. Patchies accepts nested array messages.'
  }),
  snippetCompletion('layout(location = ${0}) out vec4 ${color};', {
    label: 'layout(location)',
    type: 'keyword',
    detail: 'declare MRT output',
    info: 'Declare an additional render target output.'
  })
];

const sampler2DTypeCompletion: Completion = {
  label: 'sampler2D',
  type: 'type',
  info: 'Opaque 2D texture sampler type for uniforms and function parameters.'
};

const sampler2DDeclarationCompletions: Completion[] = [sampler2DTypeCompletion];

const builtInValueCompletions: Completion[] = [
  {
    label: 'uv',
    type: 'variable',
    detail: 'vec2',
    info: 'Patchies-injected normalized UV coordinate.'
  },
  {
    label: 'iResolution',
    type: 'variable',
    detail: 'vec3',
    info: 'Viewport resolution: width, height, aspect.'
  },
  { label: 'iTime', type: 'variable', detail: 'float', info: 'Shader playback time in seconds.' },
  {
    label: 'iTimeDelta',
    type: 'variable',
    detail: 'float',
    info: 'Seconds since the previous frame.'
  },
  { label: 'iFrame', type: 'variable', detail: 'int', info: 'Current rendered frame number.' },
  { label: 'iMouse', type: 'variable', detail: 'vec4', info: 'Mouse position and button state.' },
  {
    label: 'fragColor',
    type: 'variable',
    detail: 'vec4',
    info: 'Conventional mainImage output color parameter.'
  },
  {
    label: 'gl_FragCoord',
    type: 'variable',
    detail: 'vec4',
    info: 'Window-relative fragment coordinate.'
  },
  {
    label: 'gl_FragColor',
    type: 'variable',
    detail: 'vec4',
    info: 'Legacy single fragment color output.'
  }
];

const expressionFunctionCompletions: Completion[] = [
  ...[
    ['texture', '(sampler: sampler2D, uv: vec2) => vec4', 'Sample a 2D texture.'],
    [
      'texelFetch',
      '(sampler: sampler2D, coord: ivec2, lod: int) => vec4',
      'Fetch a texture texel by integer coordinate.'
    ],
    ['sin', '(x: float | vecN) => same', 'Sine of an angle in radians.'],
    ['cos', '(x: float | vecN) => same', 'Cosine of an angle in radians.'],
    ['tan', '(x: float | vecN) => same', 'Tangent of an angle in radians.'],
    ['asin', '(x: float | vecN) => same', 'Inverse sine, returning radians.'],
    ['acos', '(x: float | vecN) => same', 'Inverse cosine, returning radians.'],
    ['atan', '(y: float, x: float) => float', 'Arctangent from y and x, returning radians.'],
    ['pow', '(base: T, exponent: T) => T', 'Raise base to exponent.'],
    ['exp', '(x: float | vecN) => same', 'Raise e to the input value.'],
    ['log', '(x: float | vecN) => same', 'Natural logarithm.'],
    ['sqrt', '(x: float | vecN) => same', 'Square root.'],
    ['inversesqrt', '(x: float | vecN) => same', 'Reciprocal square root.'],
    ['abs', '(x: float | vecN) => same', 'Absolute value.'],
    ['sign', '(x: float | vecN) => same', 'Return -1, 0, or 1 from the sign of x.'],
    ['floor', '(x: float | vecN) => same', 'Largest integer not greater than x.'],
    ['ceil', '(x: float | vecN) => same', 'Smallest integer not less than x.'],
    ['fract', '(x: float | vecN) => same', 'Fractional part of x.'],
    ['mod', '(x: T, y: T | float) => T', 'Remainder after division.'],
    ['min', '(a: T, b: T | float) => T', 'Component-wise minimum.'],
    ['max', '(a: T, b: T | float) => T', 'Component-wise maximum.'],
    ['clamp', '(x: T, min: T | float, max: T | float) => T', 'Constrain x between min and max.'],
    ['mix', '(a: T, b: T, amount: T | float) => T', 'Linearly interpolate between values.'],
    ['step', '(edge: T | float, x: T) => T', 'Return 0 below edge, otherwise 1.'],
    [
      'smoothstep',
      '(edge0: T | float, edge1: T | float, x: T) => T',
      'Smooth Hermite interpolation.'
    ],
    ['length', '(v: vecN) => float', 'Vector magnitude.'],
    ['distance', '(a: vecN, b: vecN) => float', 'Distance between two points.'],
    ['dot', '(a: vecN, b: vecN) => float', 'Dot product.'],
    ['cross', '(a: vec3, b: vec3) => vec3', 'Cross product of two vec3 values.'],
    ['normalize', '(v: vecN) => vecN', 'Scale a vector to unit length.'],
    [
      'reflect',
      '(incident: vecN, normal: vecN) => vecN',
      'Reflect an incident vector around a normal.'
    ],
    [
      'refract',
      '(incident: vecN, normal: vecN, eta: float) => vecN',
      'Refract an incident vector through a surface normal.'
    ]
  ].map(([label, detail, info]) => ({
    label,
    type: 'function',
    detail,
    info,
    apply: `${label}()`
  }))
];

const includeCompletions: Completion[] = [
  snippetCompletion('#include <lygia/${path}>', {
    label: '#include <lygia/...>',
    type: 'keyword',
    detail: 'include Lygia shader library code',
    info: 'Import a GLSL helper from Lygia.'
  }),
  snippetCompletion('#include "${path}"', {
    label: '#include "..."',
    type: 'keyword',
    detail: 'include VFS or URL shader code',
    info: 'Import GLSL from the patch VFS, npm-style path, or URL.'
  })
];

function isExpressionCompletionPosition(context: CMCompletionContext, from: number): boolean {
  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = line.text.slice(0, from - line.from);
  const trimmedPrefix = linePrefix.trimEnd();

  if (!trimmedPrefix) return false;

  return /[=([,{?:+\-*/%&|^!<>]$/.test(trimmedPrefix) || /(?:^|[^\w$])return\s+$/.test(linePrefix);
}

function isSampler2DDeclarationPosition(context: CMCompletionContext, from: number): boolean {
  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = line.text.slice(0, from - line.from);
  const trimmedPrefix = linePrefix.trimEnd();
  const lastOpenParen = trimmedPrefix.lastIndexOf('(');
  const lastCloseParen = trimmedPrefix.lastIndexOf(')');

  return (
    /(?:^|[^\w])uniform\s+$/.test(linePrefix) ||
    (lastOpenParen > lastCloseParen &&
      (/[,(]\s*(?:in\s+|out\s+|inout\s+)?$/.test(trimmedPrefix) ||
        /(?:^|[^\w])(?:in|out|inout)\s+$/.test(linePrefix)))
  );
}

function isPreprocessorCompletionPosition(context: CMCompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);

  return /^[ \t]*#\w*$/.test(beforeCursor);
}

export function createGlslCompletionSource() {
  return (context: CMCompletionContext) => {
    if (isPreprocessorCompletionPosition(context)) {
      const directive = context.matchBefore(/#\w*/);
      if (!directive) return null;

      return {
        from: directive.from,
        options: includeCompletions,
        validFor: /^#\w*$/
      };
    }

    const word = context.matchBefore(/[A-Za-z_]\w*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    if (isCompletionSuppressedByComment(context, word.from)) return null;

    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();
    const isExpressionPosition = isExpressionCompletionPosition(context, word.from);
    const options = [
      ...statementCompletions,
      ...builtInValueCompletions,
      ...(isSampler2DDeclarationPosition(context, word.from)
        ? sampler2DDeclarationCompletions
        : []),
      ...(isExpressionPosition ? expressionFunctionCompletions : [])
    ].filter((completion) => completion.label.toLowerCase().startsWith(typedText));

    return {
      from: word.from,
      options,
      validFor: /^[A-Za-z_]\w*$/
    };
  };
}

export const glslCompletions = createGlslCompletionSource();
