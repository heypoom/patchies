import type { ExtensionPack } from '../../stores/extensions.store';

/**
 * Built-in extension packs organized by persona/use-case
 */
export const BUILT_IN_PACKS: ExtensionPack[] = [
  {
    id: 'starters',
    name: 'Starters',
    description: 'Core building blocks everyone needs',
    icon: 'Box',
    objects: ['js', 'msg', 'button', 'toggle', 'slider', 'peek', 'label']
  },
  {
    id: 'media',
    name: 'Media',
    description: 'Video and image sources & sinks',
    icon: 'Camera',
    objects: ['webcam', 'video', 'img', 'screen', 'bg.out']
  },
  {
    id: '2d',
    name: '2D Graphics',
    description: 'Canvas and text-based drawing',
    icon: 'Palette',
    objects: ['p5', 'canvas', 'canvas.dom', 'textmode', 'textmode.dom']
  },
  {
    id: 'video-synthesis',
    name: 'Video Synths',
    description: 'Hydra, shaders and 3D graphics',
    icon: 'Shapes',
    objects: ['hydra', 'three', 'three.dom', 'glsl', 'swgl']
  },
  {
    id: 'audio',
    name: 'Audio',
    description: 'Sound synthesis and I/O',
    icon: 'AudioLines',
    objects: [
      'osc~',
      'sig~',
      'gain~',
      'pan~',
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
    id: 'audio-filters',
    name: 'Audio Filters',
    description: 'Filters and effects processing',
    icon: 'SlidersHorizontal',
    objects: [
      'lowpass~',
      'highpass~',
      'bandpass~',
      'notch~',
      'lowshelf~',
      'highshelf~',
      'peaking~',
      'allpass~',
      'delay~',
      'compressor~',
      'waveshaper~',
      'convolver~'
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
  },
  {
    id: 'experimental',
    name: 'Experimental',
    description: 'Unstable or work-in-progress nodes',
    icon: 'FlaskConical',
    objects: ['bchrn']
  }
];
