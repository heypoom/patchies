import { writable, derived } from 'svelte/store';

export interface ExtensionPack {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  objects: string[];
}

/**
 * Built-in extension packs organized by persona/use-case
 */
export const BUILT_IN_PACKS: ExtensionPack[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    description: 'Core building blocks everyone needs',
    icon: 'Sparkles',
    objects: ['js', 'msg', 'button', 'toggle', 'slider', 'peek', 'label', 'print']
  },
  {
    id: 'visual',
    name: 'Visual',
    description: 'Graphics, shaders, and video processing',
    icon: 'Palette',
    objects: [
      'p5',
      'hydra',
      'glsl',
      'swgl',
      'canvas',
      'canvas.dom',
      'three',
      'three.dom',
      'textmode',
      'textmode.dom',
      'webcam',
      'video',
      'img',
      'screen',
      'bg.out',
      'bchrn'
    ]
  },
  {
    id: 'audio',
    name: 'Audio',
    description: 'Sound synthesis and effects',
    icon: 'AudioLines',
    objects: [
      'osc~',
      'sig~',
      'gain~',
      'pan~',
      'delay~',
      'lowpass~',
      'highpass~',
      'bandpass~',
      'notch~',
      'lowshelf~',
      'highshelf~',
      'peaking~',
      'allpass~',
      'compressor~',
      'waveshaper~',
      'convolver~',
      'add~',
      'dac~',
      'mic~',
      'soundfile~',
      'sampler~',
      'fft~',
      'meter~',
      'merge~',
      'split~'
    ]
  },
  {
    id: 'livecoding',
    name: 'Livecoding',
    description: 'Music livecoding languages',
    icon: 'Music',
    objects: ['strudel', 'chuck~', 'csound~', 'sonic~', 'elem~', 'tone~', 'dsp~', 'expr~', 'orca']
  },
  {
    id: 'dataflow',
    name: 'Data Flow',
    description: 'Functional message processing',
    icon: 'GitBranch',
    objects: [
      'filter',
      'map',
      'tap',
      'scan',
      'uniq',
      'expr',
      'trigger',
      'select',
      'spigot',
      'float',
      'int',
      'metro',
      'delay',
      'throttle',
      'debounce',
      'loadbang',
      'uniqby',
      'adsr',
      'mtof'
    ]
  },
  {
    id: 'ui',
    name: 'UI Controls',
    description: 'Interface building components',
    icon: 'Layout',
    objects: ['dom', 'vue', 'keyboard', 'textbox', 'markdown', 'link', 'iframe']
  },
  {
    id: 'networking',
    name: 'Networking',
    description: 'External communication and I/O',
    icon: 'Wifi',
    objects: [
      'netsend',
      'netrecv',
      'mqtt',
      'sse',
      'midi.in',
      'midi.out',
      'tts',
      'vdo.ninja.push',
      'vdo.ninja.pull',
      'webmidilink'
    ]
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'AI-powered generation nodes',
    icon: 'Brain',
    objects: ['ai.txt', 'ai.img', 'ai.music', 'ai.tts']
  },
  {
    id: 'esoteric',
    name: 'Esoteric',
    description: 'Alternative languages and VMs',
    icon: 'Cpu',
    objects: ['uxn', 'asm', 'asm.mem', 'ruby', 'python', 'worker']
  }
];

const STORAGE_KEY = 'patchies:enabled-packs';
const DEFAULT_ENABLED_PACKS = ['essentials'];

function getInitialEnabledPacks(): string[] {
  if (typeof localStorage === 'undefined') return DEFAULT_ENABLED_PACKS;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_ENABLED_PACKS;

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Invalid JSON, use defaults
  }
  return DEFAULT_ENABLED_PACKS;
}

/**
 * Store of enabled pack IDs
 */
export const enabledPackIds = writable<string[]>(getInitialEnabledPacks());

// Persist to localStorage
if (typeof localStorage !== 'undefined') {
  enabledPackIds.subscribe((ids) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  });
}

/**
 * Derived set of all enabled object names
 */
export const enabledObjects = derived(enabledPackIds, ($enabledPackIds) => {
  const objects = new Set<string>();

  for (const packId of $enabledPackIds) {
    const pack = BUILT_IN_PACKS.find((p) => p.id === packId);
    if (pack) {
      for (const obj of pack.objects) {
        objects.add(obj);
      }
    }
  }

  return objects;
});

/**
 * Toggle a pack on/off
 */
export function togglePack(packId: string): void {
  enabledPackIds.update((ids) => {
    if (ids.includes(packId)) {
      return ids.filter((id) => id !== packId);
    } else {
      return [...ids, packId];
    }
  });
}

/**
 * Enable all packs
 */
export function enableAllPacks(): void {
  enabledPackIds.set(BUILT_IN_PACKS.map((p) => p.id));
}

/**
 * Disable all packs (except essentials for safety)
 */
export function disableAllPacks(): void {
  enabledPackIds.set(['essentials']);
}

/**
 * Check if a pack is enabled
 */
export function isPackEnabled(packId: string, enabledIds: string[]): boolean {
  return enabledIds.includes(packId);
}
