import {
  CompletionContext as CMCompletionContext,
  type Completion
} from '@codemirror/autocomplete';
import { isCompletionSuppressedByComment } from '$lib/codemirror/completion-utils';
import {
  isGlslInJavaScriptCompletionContext,
  isJavaScriptStringCompletionContext
} from '$lib/codemirror/glsl-in-js';
import type { PatchiesContext } from '$lib/codemirror/patchies-completions';
import {
  generatorTransforms,
  modifierTransforms,
  type TransformDefinition,
  type TransformDefinitionInput
} from '$lib/hydra/glsl/transformDefinitions';

const HYDRA_NODE_TYPE = 'hydra';

const hydraTransformInfo: Record<string, string> = {
  src: 'Use a Hydra source, output, or video input as a chain source.',
  osc: 'Create a color oscillator with separate red, green, and blue phase offsets.',
  gradient: 'Create an XY color gradient, optionally animated over time.',
  shape: 'Create a regular polygon mask with controllable radius and edge softness.',
  voronoi: 'Create animated Voronoi cells with controllable scale, speed, and blending.',
  noise: 'Create animated procedural noise.',
  solid: 'Create a solid color source.',
  rotate: 'Rotate coordinates in the current chain.',
  scale: 'Scale coordinates in the current chain.',
  pixelate: 'Pixelate coordinates in the current chain.',
  posterize: 'Reduce the current chain into stepped color bands.',
  shift: 'Offset RGBA channels, wrapping values back into the 0..1 range.',
  repeat: 'Tile the current chain in X and Y, with optional alternating offsets.',
  modulateRepeat: 'Use another chain to vary repeated tile offsets.',
  repeatX: 'Tile the current chain horizontally.',
  modulateRepeatX: 'Use another chain to vary horizontal tile offsets.',
  repeatY: 'Tile the current chain vertically.',
  modulateRepeatY: 'Use another chain to vary vertical tile offsets.',
  kaleid: 'Mirror the current chain into kaleidoscopic radial segments.',
  modulateKaleid: 'Use another chain to vary kaleidoscope coordinates.',
  scroll: 'Scroll the current chain in X and Y over time.',
  scrollX: 'Scroll the current chain horizontally over time.',
  modulateScrollX: 'Use another chain to vary horizontal scrolling.',
  scrollY: 'Scroll the current chain vertically over time.',
  modulateScrollY: 'Use another chain to vary vertical scrolling.',
  add: 'Add another chain into this chain, blended by amount.',
  sub: 'Subtract another chain from this chain, blended by amount.',
  layer: 'Alpha-composite another chain over the current chain.',
  blend: 'Crossfade between this chain and another chain.',
  mult: 'Multiply this chain with another chain, blended by amount.',
  diff: 'Show the absolute RGB difference between this chain and another chain.',
  modulate: 'Use another chain as an XY coordinate offset.',
  modulateScale: 'Use another chain to scale coordinates around the center.',
  modulatePixelate: 'Use another chain to vary pixelation size.',
  modulateRotate: 'Use another chain to rotate coordinates around the center.',
  modulateHue: 'Use another chain color difference to warp coordinates.',
  invert: 'Invert RGB colors, blended by amount.',
  contrast: 'Increase or decrease contrast around middle gray.',
  brightness: 'Add brightness to RGB colors.',
  mask: 'Use another chain luminance as this chain alpha mask.',
  luma: 'Use luminance as alpha, fading pixels in above the threshold.',
  thresh: 'Convert luminance into a black-and-white threshold.',
  color: 'Multiply or invert channels with the given RGBA values.',
  saturate: 'Push colors away from or toward grayscale.',
  hue: 'Shift hue in HSV color space.',
  colorama: 'Cycle HSV color values and wrap them into psychedelic bands.',
  sum: 'Sum color channels into a single value.',
  r: 'Extract and scale the red channel.',
  g: 'Extract and scale the green channel.',
  b: 'Extract and scale the blue channel.',
  a: 'Extract and scale the alpha channel.',
  out: 'Route this chain to a Hydra output.'
};

const hydraRuntimeCompletions: Completion[] = [
  { label: 'h', type: 'variable', detail: 'Hydra synth', info: 'Full Hydra synth instance.' },
  { label: 'time', type: 'variable', detail: 'number', info: 'Current Hydra synth time.' },
  { label: 'width', type: 'variable', detail: 'number', info: 'Current render output width.' },
  { label: 'height', type: 'variable', detail: 'number', info: 'Current render output height.' },
  {
    label: 'mouse',
    type: 'variable',
    detail: '{ x: number, y: number, down: boolean }',
    info: 'Mouse state for this Hydra node.'
  },
  {
    label: 'render',
    type: 'function',
    detail: '() => void',
    info: 'Run Hydra render manually.',
    apply: 'render()'
  },
  {
    label: 'hush',
    type: 'function',
    detail: '() => void',
    info: 'Clear active Hydra outputs.',
    apply: 'hush()'
  },
  {
    label: 'setFunction',
    type: 'function',
    detail: '(definition) => Promise<Source | void>',
    info: 'Define a custom Hydra generator or modifier.',
    apply:
      "await setFunction({\n  name: 'custom',\n  type: 'src',\n  inputs: [],\n  glsl: `\\n    return vec4(vec3(1.0), 1.0);\\n  `,\n})"
  },
  {
    label: 'datamosh',
    type: 'function',
    detail: '(source, params?) => Source',
    info: 'Route a Hydra source through the native WebCodecs datamosh effect. Params: speed, keyFrame, fps, bitrate, scale, width, height.',
    apply: 'datamosh(s0, { speed: 2, fps: 30, scale: 0.5 })'
  }
];

const hydraChainRuntimeCompletions: Completion[] = [
  {
    label: 'out',
    type: 'method',
    detail: '(output?: Output) => void',
    info: 'Route this chain to a Hydra output.',
    apply: 'out()'
  }
];

function formatDefaultValue(value: TransformDefinitionInput['default']): string | undefined {
  if (value === undefined || typeof value === 'function') return;
  if (typeof value === 'number' && Number.isNaN(value)) return;

  return Array.isArray(value) ? `[${value.join(', ')}]` : String(value);
}

function formatInput(input: TransformDefinitionInput): string {
  const defaultValue = formatDefaultValue(input.default);
  const type = input.type === 'sampler2D' ? 'source' : input.type;
  const base = `${input.name}: ${type}`;

  return defaultValue === undefined ? base : `${base} = ${defaultValue}`;
}

function transformReturnType(definition: TransformDefinition): string {
  return definition.type === 'src' ? 'Source' : 'Chain';
}

function transformType(definition: TransformDefinition): string {
  return definition.type === 'src' ? 'function' : 'method';
}

function transformInfo(definition: TransformDefinition): string {
  return hydraTransformInfo[definition.name] ?? `Hydra ${definition.type} transform.`;
}

function createTransformCompletion(definition: TransformDefinition): Completion {
  const args = definition.inputs?.map(formatInput).join(', ') ?? '';

  return {
    label: definition.name,
    type: transformType(definition),
    detail: `(${args}) => ${transformReturnType(definition)}`,
    info: transformInfo(definition),
    apply: `${definition.name}()`
  };
}

const hydraGeneratorCompletions: Completion[] = generatorTransforms.map(createTransformCompletion);

const hydraChainCompletions: Completion[] = [
  ...modifierTransforms.map(createTransformCompletion),
  ...hydraChainRuntimeCompletions
];

const hydraGlobalCompletions: Completion[] = [
  ...hydraGeneratorCompletions,
  ...hydraRuntimeCompletions
];

const hydraCompletions: Completion[] = [...hydraGlobalCompletions, ...hydraChainCompletions];

function getMatchingCompletions(completions: Completion[], typedText: string): Completion[] {
  return completions.filter((completion) => completion.label.toLowerCase().startsWith(typedText));
}

export function createHydraCompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CMCompletionContext) => {
    if (patchiesContext?.nodeType !== HYDRA_NODE_TYPE) return null;
    if (isJavaScriptStringCompletionContext(context)) return null;
    if (isGlslInJavaScriptCompletionContext(context)) return null;

    const member = context.matchBefore(/\.[A-Za-z_$][\w$]*$/);

    if (member) {
      if (isCompletionSuppressedByComment(context, member.from)) return null;

      const typedText = context.state.doc.sliceString(member.from + 1, member.to).toLowerCase();

      return {
        from: member.from + 1,
        options: getMatchingCompletions(hydraChainCompletions, typedText),
        validFor: /^[A-Za-z_$][\w$]*$/
      };
    }

    const word = context.matchBefore(/[A-Za-z_$][\w$]*/);
    if (!word) return null;

    if (word.from === word.to && !context.explicit) return null;
    if (isCompletionSuppressedByComment(context, word.from)) return null;

    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();

    return {
      from: word.from,
      options: getMatchingCompletions(hydraGlobalCompletions, typedText),
      validFor: /^[A-Za-z_$][\w$]*$/
    };
  };
}

export const getHydraCompletionByLabel = (label: string): Completion | undefined =>
  hydraCompletions.find((completion) => completion.label === label);

export const hydraCompletionsSource = (context?: PatchiesContext) =>
  createHydraCompletionSource(context);
