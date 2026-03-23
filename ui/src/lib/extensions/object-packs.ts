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
    objects: [
      'js',
      'msg',
      'button',
      'toggle',
      'slider',
      'knob',
      'textbox',
      'peek',
      'label',
      'note',
      'sheet'
    ]
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
      'float',
      'int',
      'stack',
      'queue',
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
    objects: ['filter', 'map', 'tap', 'scan', 'select', 'uniq', 'uniqby', 'unpack', 'expr', 'clip']
  },
  {
    id: 'ui',
    name: 'User Interfaces',
    description: 'Interface building components',
    icon: 'Layout',
    objects: ['keyboard', 'markdown', 'iframe', 'link', 'dom', 'vue', 'switch', 'curve']
  },
  {
    id: 'media',
    name: 'Media',
    description: 'Starter kits for video and audio',
    icon: 'Camera',
    objects: [
      'webcam',
      'video',
      'img',
      'screen',
      'mic~',
      'gain~',
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
    description: 'Interactive 2D canvas objects',
    icon: 'Palette',
    objects: ['p5', 'canvas', 'canvas.dom', 'textmode', 'textmode.dom']
  },
  {
    id: 'video-synthesis',
    name: 'Video Synths',
    description: 'Hydra, shaders and 3D graphics',
    icon: 'Shapes',
    objects: ['hydra', 'three', 'three.dom', 'glsl', 'swgl', 'projmap']
  },
  {
    id: 'music',
    name: 'Music',
    description: 'Composition and audio synthesis',
    icon: 'Music',
    objects: [
      'beat',
      'sequencer',
      'strudel',
      'orca',
      'sonic~',
      'chuck~',
      'csound~',
      'tone~',
      'bytebeat~',
      'ngea'
    ]
  },
  {
    id: 'scripting',
    name: 'Scripting',
    description: 'Scripting languages and workers',
    icon: 'Code',
    objects: ['worker', 'ruby', 'python', 'uiua', 'wgpu.compute']
  },
  {
    id: 'low-level',
    name: 'Low Level',
    description: 'Low level VMs & languages',
    icon: 'Cpu',
    objects: ['uxn', 'asm', 'asm.mem']
  },
  {
    id: 'midi',
    name: 'MIDI',
    description: 'MIDI input and output',
    icon: 'Piano',
    objects: ['midi.in', 'midi.out', 'webmidilink', 'mtof']
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
      'vdo.ninja.push',
      'vdo.ninja.pull',
      'serial',
      'serial.term',
      'serial.dmx'
    ]
  },
  {
    id: 'vision',
    name: 'Vision',
    description: 'Real-time ML vision detection',
    icon: 'Eye',
    objects: [
      'vision.hand',
      'vision.body',
      'vision.face',
      'vision.segment',
      'vision.detect',
      'vision.gesture',
      'vision.classify'
    ]
  },
  {
    id: 'audio-routing',
    name: 'Audio Routing',
    description: 'Mixing, routing and monitoring',
    icon: 'Route',
    objects: ['pan~', 'split~', 'merge~', 'send~', 'recv~', 'meter~', 'scope~', 'fft~']
  },
  {
    id: 'signal-generators',
    name: 'Signal Generators',
    description: 'Oscillators and signal generators',
    icon: 'AudioLines',
    objects: [
      'osc~',
      'noise~',
      'pink~',
      'phasor~',
      'pulse~',
      'beat~',
      'sig~',
      'line~',
      'vline~',
      'adsr~',
      'adsr'
    ]
  },
  {
    id: 'audio-effects',
    name: 'Audio Effects',
    description: 'Signal filters, dynamics, and effects',
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
      'convolver~',
      'comb~',
      'vcf~',
      'biquad~',
      'slop~'
    ]
  },
  {
    id: 'signal-math',
    name: 'Signal Math',
    description: 'Signal arithmetic and shaping',
    icon: 'Calculator',
    objects: [
      '+~',
      '*~',
      '-~',
      '/~',
      'min~',
      'max~',
      '>~',
      '<~',
      'clip~',
      'wrap~',
      'abs~',
      'pow~',
      'sqrt~',
      'rsqrt~',
      'log~',
      'exp~',
      'cos~',
      'mtof~',
      'ftom~'
    ]
  },
  {
    id: 'signal-processors',
    name: 'Signal Processors',
    description: 'DSP operators and programs',
    icon: 'Activity',
    objects: [
      'elem~',
      'expr~',
      'fexpr~',
      'dsp~',
      'snapshot~',
      'samphold~',
      'bang~',
      'latch~',
      'threshold~',
      'env~',
      'samplerate~'
    ]
  },
  {
    id: 'audio-samples',
    name: 'Buffers & Tables',
    description: 'Samples, tables and delay lines',
    icon: 'FileHeadphone',
    objects: [
      'pads~',
      'sampler~',
      'table',
      'tabwrite~',
      'tabread~',
      'tabread4~',
      'tabosc4~',
      'delwrite~',
      'delread~',
      'delread4~'
    ]
  },
  {
    id: 'ai',
    name: 'AI',
    description: 'AI-powered generative objects',
    icon: 'Brain',
    objects: ['ai.txt', 'ai.img', 'ai.music', 'ai.tts', 'ai.stt', 'tts', 'stt']
  },
  {
    id: 'experimental',
    name: 'Experimental',
    description: 'Unstable or work-in-progress',
    icon: 'FlaskConical',
    objects: ['bchrn']
  }
];
