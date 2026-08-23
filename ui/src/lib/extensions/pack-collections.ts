export type PackCollectionId =
  | 'essentials'
  | 'visuals'
  | 'music'
  | 'sound-design'
  | 'code-and-data'
  | 'connect'
  | 'ai';

export interface PackCollection {
  id: PackCollectionId;
  name: string;
  description: string;
  icon: string;
  primaryObjectPackIds: string[];
  primaryPresetPackIds: string[];
  optionalPresetPackIds: string[];
  supportingObjectTypes: string[];
}

export const BUILT_IN_PACK_COLLECTIONS: PackCollection[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    description: 'Learn the patching basics and build small patches',
    icon: 'Boxes',
    primaryObjectPackIds: ['starters', 'control', 'transform'],
    primaryPresetPackIds: ['starters', 'timing-demos', 'scripting-demos'],
    optionalPresetPackIds: [],
    supportingObjectTypes: []
  },
  {
    id: 'visuals',
    name: 'Visuals',
    description: 'Make graphics, video, shaders, and interactive canvases',
    icon: 'Palette',
    primaryObjectPackIds: ['media', 'ui', '2d', 'video-synthesis'],
    primaryPresetPackIds: [
      'canvas-widgets',
      'charts',
      'hydra-operators',
      'texture-generators',
      'paper-shaders',
      'texture-composite',
      'texture-time',
      'texture-color',
      'texture-masks-keys',
      'texture-transform',
      'texture-filters',
      'iframe-widgets',
      'p5-demos',
      'float-texture-data',
      'hydra-demos',
      'shaderpark-visuals',
      'three-demos',
      'gpu-geometry',
      'ascii-art-demos'
    ],
    optionalPresetPackIds: [],
    supportingObjectTypes: []
  },
  {
    id: 'music',
    name: 'Music',
    description: 'Compose, sequence, perform, and play instruments',
    icon: 'Music',
    primaryObjectPackIds: ['music', 'midi', 'audio-samples'],
    primaryPresetPackIds: [
      'midi',
      'chuck-demos',
      'demo-compositions',
      'tone-presets',
      'supersonic-demos'
    ],
    optionalPresetPackIds: [],
    supportingObjectTypes: ['mic~', 'soundfile~', 'gain~', 'out~']
  },
  {
    id: 'sound-design',
    name: 'Sound Design',
    description: 'Craft signals, effects, routing, and audio-reactive patches',
    icon: 'AudioLines',
    primaryObjectPackIds: [
      'audio-routing',
      'signal-generators',
      'audio-effects',
      'signal-math',
      'signal-processors'
    ],
    primaryPresetPackIds: ['scope-demos', 'fft-demos', 'audio-synthesis', 'dsp-presets'],
    optionalPresetPackIds: ['greggman-bytebeat'],
    supportingObjectTypes: [
      'mic~',
      'soundfile~',
      'gain~',
      'out~',
      'p5',
      'canvas.dom',
      'hydra',
      'glsl',
      'bytebeat~'
    ]
  },
  {
    id: 'code-and-data',
    name: 'Code & Data',
    description: 'Program, transform data, and explore computational systems',
    icon: 'Code',
    primaryObjectPackIds: ['scripting', 'low-level'],
    primaryPresetPackIds: [
      'peppermint-examples',
      'asm-examples',
      'uxn-demos',
      'uiua-demos',
      'opencv-demos'
    ],
    optionalPresetPackIds: [],
    supportingObjectTypes: []
  },
  {
    id: 'connect',
    name: 'Connect',
    description: 'Work with networks, devices, cameras, and vision',
    icon: 'Wifi',
    primaryObjectPackIds: ['networking', 'vision'],
    primaryPresetPackIds: [],
    optionalPresetPackIds: [],
    supportingObjectTypes: []
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'Generative AI capabilities.',
    icon: 'FlaskConical',
    primaryObjectPackIds: ['ai'],
    primaryPresetPackIds: ['prompt-presets'],
    optionalPresetPackIds: [],
    supportingObjectTypes: []
  }
];

export const getPackCollection = (id: string): PackCollection | undefined =>
  BUILT_IN_PACK_COLLECTIONS.find((collection) => collection.id === id);

export const getCollectionObjectPackIds = (collection: PackCollection): string[] => [
  ...collection.primaryObjectPackIds
];

export const getPrimaryCollectionForPack = (
  packId: string,
  kind: 'object' | 'preset'
): PackCollection | undefined =>
  BUILT_IN_PACK_COLLECTIONS.find((collection) =>
    (kind === 'object'
      ? collection.primaryObjectPackIds
      : [...collection.primaryPresetPackIds, ...collection.optionalPresetPackIds]
    ).includes(packId)
  );
