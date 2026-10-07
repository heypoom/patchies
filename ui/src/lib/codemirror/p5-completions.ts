import { CompletionContext, type Completion } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { isCompletionSuppressedByComment } from '$lib/codemirror/completion-utils';
import {
  isGlslInJavaScriptCompletionContext,
  isJavaScriptStringCompletionContext
} from '$lib/codemirror/glsl-in-js';
import type { PatchiesContext } from '$lib/codemirror/patchies-completions';
import { p5ApiEntries } from './p5-api';

const callbackNames = new Set([
  'setup',
  'draw',
  'preload',
  'mousePressed',
  'mouseReleased',
  'mouseClicked',
  'mouseMoved',
  'mouseDragged',
  'mouseWheel',
  'doubleClicked',
  'keyPressed',
  'keyReleased',
  'keyTyped',
  'touchStarted',
  'touchMoved',
  'touchEnded',
  'windowResized',
  'deviceMoved',
  'deviceTurned',
  'deviceShaken'
]);

// These APIs are installed by P5Manager's compatibility addons, not P5 v2 itself.
const compatibilityEntries: typeof p5ApiEntries = [
  [
    'preload',
    'function',
    '() => void',
    'Load assets before setup using Patchies’ P5 compatibility lifecycle.'
  ],
  [
    'touchStarted',
    'function',
    '(event: TouchEvent) => void',
    'Handle the start of a touch interaction.'
  ],
  [
    'touchMoved',
    'function',
    '(event: TouchEvent) => void',
    'Handle movement during a touch interaction.'
  ],
  [
    'touchEnded',
    'function',
    '(event: TouchEvent) => void',
    'Handle the end of a touch interaction.'
  ],
  [
    'quadraticVertex',
    'function',
    '(cx: number, cy: number, x: number, y: number) => void',
    'Add a quadratic Bézier segment to a custom shape.'
  ],
  [
    'curveVertex',
    'function',
    '(x: number, y: number, z?: number) => void',
    'Add a spline vertex to a custom shape.'
  ],
  ['curveTightness', 'function', '(tightness: number) => void', 'Set spline tightness.'],
  [
    'curve',
    'function',
    '(...coordinates: number[]) => void',
    'Draw a spline through control points.'
  ],
  [
    'curvePoint',
    'function',
    '(a: number, b: number, c: number, d: number, t: number) => number',
    'Interpolate a coordinate along a spline.'
  ],
  [
    'curveTangent',
    'function',
    '(a: number, b: number, c: number, d: number, t: number) => number',
    'Calculate a spline tangent coordinate.'
  ],
  [
    'bezierDetail',
    'function',
    '(detail?: number) => number',
    'Get or set the Bézier segment count.'
  ],
  ['beginGeometry', 'function', '() => void', 'Begin collecting shapes into a geometry.'],
  ['endGeometry', 'function', '() => p5.Geometry', 'Finish collecting shapes into a geometry.'],
  ['append', 'function', '(array: T[], value: T) => T[]', 'Append a value to an array.'],
  [
    'arrayCopy',
    'function',
    '(src: T[], dst: T[], length?: number) => void',
    'Copy array elements into another array.'
  ],
  ['concat', 'function', '(list0: T[], list1: T[]) => T[]', 'Combine two arrays.'],
  ['reverse', 'function', '(list: T[]) => T[]', 'Reverse an array in place.'],
  ['shorten', 'function', '(list: T[]) => T[]', 'Remove the last array element.'],
  [
    'sort',
    'function',
    '(list: (string | number)[], count?: number) => (string | number)[]',
    'Sort an array or its first count elements.'
  ],
  [
    'splice',
    'function',
    '(list: T[], value: T | T[], index: number) => T[]',
    'Insert values into an array.'
  ],
  [
    'subset',
    'function',
    '(list: T[], start: number, count?: number) => T[]',
    'Copy a range of array elements.'
  ],
  [
    'join',
    'function',
    '(list: unknown[], separator?: string) => string',
    'Join array elements into text.'
  ],
  [
    'match',
    'function',
    '(text: string, pattern: string | RegExp) => RegExpMatchArray | null',
    'Find a regular expression match.'
  ],
  [
    'matchAll',
    'function',
    '(text: string, pattern: string | RegExp) => RegExpExecArray[]',
    'Find all regular expression matches.'
  ],
  [
    'split',
    'function',
    '(text: string, delimiter: string | RegExp) => string[]',
    'Split text into an array.'
  ],
  [
    'trim',
    'function',
    '(text: string | string[]) => string | string[]',
    'Remove leading and trailing whitespace.'
  ],
  [
    'createStringDict',
    'function',
    '(key: string | Record<string, string>, value?: string) => p5.StringDict',
    'Create a dictionary of string values.'
  ],
  [
    'createNumberDict',
    'function',
    '(key: string | Record<string, number>, value?: number) => p5.NumberDict',
    'Create a dictionary of number values.'
  ],
  ['p5.TypedDict', 'class', 'p5.TypedDict', 'Patchies compatibility dictionary constructor.'],
  [
    'p5.StringDict',
    'class',
    'p5.StringDict',
    'Patchies compatibility string dictionary constructor.'
  ],
  [
    'p5.NumberDict',
    'class',
    'p5.NumberDict',
    'Patchies compatibility number dictionary constructor.'
  ]
];

const p5Completions: Completion[] = [
  ...p5ApiEntries,
  ...compatibilityEntries,
  ['p5', 'variable', 'typeof p5', 'P5 constructor exposed by Patchies.']
].map(([label, type, detail, info]) => ({
  label,
  type,
  detail,
  info,

  // Lifecycle callbacks are defined by users, rather than called directly.
  apply: type === 'function' && !callbackNames.has(label) ? `${label}()` : label
}));

export function createP5CompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CompletionContext) => {
    if (patchiesContext?.nodeType !== 'p5') return null;

    const node = syntaxTree(context.state).resolveInner(context.pos, -1);
    if (node.name === 'LineComment' || node.name === 'BlockComment') return null;

    if (isJavaScriptStringCompletionContext(context)) return null;
    if (isGlslInJavaScriptCompletionContext(context)) return null;

    const word = context.matchBefore(/[A-Za-z_$][\w$]*$/);
    const from = word?.from ?? context.pos;
    const before = context.state.doc.sliceString(0, from).trimEnd();
    const namespace = before.match(/\bp5\s*\.\s*(?:Vector\s*\.\s*)?$/)?.[0];
    const prefix = namespace?.replace(/\s/g, '') ?? '';

    if (before.endsWith('.') && !prefix) return null;
    if (!word && !prefix && !context.explicit) return null;
    if (isCompletionSuppressedByComment(context, from)) return null;

    const typedText = word?.text.toLowerCase() ?? '';

    const options = p5Completions
      .filter((completion) => completion.label.startsWith(prefix))
      .filter((completion) => {
        const label = completion.label.slice(prefix.length);

        return !label.includes('.') && label.toLowerCase().startsWith(typedText);
      })
      .map((completion) => ({
        ...completion,
        label: completion.label.slice(prefix.length),
        apply:
          typeof completion.apply === 'string'
            ? completion.apply.slice(prefix.length)
            : completion.apply
      }));

    return { from, options, validFor: /^[A-Za-z_$][\w$]*$/ };
  };
}

export const getP5CompletionByLabel = (label: string): Completion | undefined =>
  p5Completions.find((completion) => completion.label === label);

export const p5CompletionsSource = (context?: PatchiesContext) => createP5CompletionSource(context);
