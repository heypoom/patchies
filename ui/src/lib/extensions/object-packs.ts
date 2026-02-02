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
    objects: ['js', 'msg', 'button', 'toggle', 'slider', 'textbox', 'peek', 'label', 'bg.out']
  },
  {
    id: 'media',
    name: 'Media',
    description: 'Video, image and audio sources',
    icon: 'Camera',
    objects: ['webcam', 'video', 'img', 'screen', 'mic~', 'soundfile~']
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
    description: 'Operators for working with audio',
    icon: 'AudioLines',
    objects: [
      'dac~',
      'sampler~',
      'osc~',
      'sig~',
      'gain~',
      'pan~',
      'add~',
      'fft~',
      'meter~',
      'merge~',
      'split~',
      'adsr',
      'mtof'
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
    id: 'music',
    name: 'Music',
    description: 'Composition and audio synthesis',
    icon: 'Music',
    objects: ['strudel', 'orca', 'sonic~', 'chuck~', 'csound~', 'tone~']
  },
  {
    id: 'dsp',
    name: 'DSP',
    description: 'Low-level signal processing',
    icon: 'Activity',
    objects: ['elem~', 'expr~', 'dsp~']
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
      'uniqby'
    ]
  },
  {
    id: 'ui',
    name: 'UI Controls',
    description: 'Interface building components',
    icon: 'Layout',
    objects: ['dom', 'vue', 'keyboard', 'markdown', 'link', 'iframe']
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
    objects: ['ai.txt', 'ai.img', 'ai.music', 'ai.tts', 'tts']
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Alternative scripting languages',
    icon: 'Code',
    objects: ['ruby', 'python', 'worker']
  },
  {
    id: 'low-level',
    name: 'Low Level',
    description: 'Low level virtual machines',
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
