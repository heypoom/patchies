import type { ExtensionPack } from '../../stores/extensions.store';

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
      'split~',
      'tts'
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
    objects: ['netsend', 'netrecv', 'mqtt', 'sse', 'vdo.ninja.push', 'vdo.ninja.pull']
  },
  {
    id: 'midi',
    name: 'MIDI',
    description: 'MIDI input and output',
    icon: 'Piano',
    objects: ['midi.in', 'midi.out', 'webmidilink']
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'AI-powered generation nodes',
    icon: 'Brain',
    objects: ['ai.txt', 'ai.img', 'ai.music', 'ai.tts']
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Alternative scripting languages',
    icon: 'Code',
    objects: ['ruby', 'python', 'worker']
  },
  {
    id: 'esoteric',
    name: 'Esoteric',
    description: 'Obscure VMs and languages',
    icon: 'Cpu',
    objects: ['uxn', 'asm', 'asm.mem']
  }
];
