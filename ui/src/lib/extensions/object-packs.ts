import type { ExtensionPack } from '../../stores/extensions.store';

/**
 * Built-in extension packs organized by persona/use-case
 */
export const BUILT_IN_PACKS: ExtensionPack[] = [
  {
    id: 'starters',
    name: 'Starters',
    description: 'Building blocks everyone needs',
    icon: 'Box',
    objects: ['js', 'msg', 'button', 'toggle', 'slider', 'textbox', 'peek', 'label', 'note', 'knob']
  },
  {
    id: 'control',
    name: 'Control',
    description: 'When and where messages go',
    icon: 'GitBranch',
    objects: [
      'loadbang',
      'metro',
      'trigger',
      'spigot',
      'delay',
      'throttle',
      'debounce',
      'f',
      'i',
      'kv',
      'send',
      'recv'
    ]
  },
  {
    id: 'transform',
    name: 'Transforms',
    description: 'Process and filter messages',
    icon: 'ArrowRightLeft',
    objects: ['filter', 'map', 'tap', 'scan', 'select', 'uniq', 'uniqby', 'expr']
  },
  {
    id: 'ui',
    name: 'User Interface',
    description: 'Interface building components',
    icon: 'Layout',
    objects: ['keyboard', 'markdown', 'iframe', 'link', 'dom', 'vue', 'switch']
  },
  {
    id: 'media',
    name: 'Media',
    description: 'Source and sinks for video and audio',
    icon: 'Camera',
    objects: [
      'webcam',
      'video',
      'img',
      'screen',
      'mic~',
      'soundfile~',
      'out~',
      'bg.out',
      'send.vdo',
      'recv.vdo'
    ]
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
      'gain~',
      'osc~',
      'sampler~',
      'meter~',
      'sig~',
      'pan~',
      '+~',
      'fft~',
      'split~',
      'merge~',
      'send~',
      'recv~',
      'line~',
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
    id: 'midi',
    name: 'MIDI',
    description: 'MIDI input and output',
    icon: 'Piano',
    objects: ['midi.in', 'midi.out', 'webmidilink']
  },
  {
    id: 'networking',
    name: 'Networking',
    description: 'External communication and I/O',
    icon: 'Wifi',
    objects: ['netsend', 'netrecv', 'mqtt', 'sse', 'vdo.ninja.push', 'vdo.ninja.pull']
  },
  {
    id: 'scripting',
    name: 'Scripting',
    description: 'Scripting languages and workers',
    icon: 'Code',
    objects: ['worker', 'ruby', 'python', 'wgpu.compute']
  },
  {
    id: 'dsp',
    name: 'DSP',
    description: 'Low-level audio signal processing',
    icon: 'Activity',
    objects: ['elem~', 'expr~', 'dsp~']
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'AI-powered generation nodes',
    icon: 'Brain',
    objects: ['ai.txt', 'ai.img', 'ai.music', 'ai.tts', 'tts']
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
