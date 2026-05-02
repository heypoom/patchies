import type { PresetPack } from '../../stores/extensions.store';

export const OBJECT_PIPE_PRESETS = ['js>', 'hydra>', 'glsl>', 'regl>', 'swgl>', 'three>', 'tone>'];

/**
 * Built-in preset packs organized by use-case
 * Each preset belongs to exactly one pack (mutually exclusive)
 */
export const BUILT_IN_PRESET_PACKS: PresetPack[] = [
  {
    id: 'starters',
    name: 'Starter Presets',
    description: 'Essentials for getting started',
    icon: 'Boxes',
    requiredObjects: [],
    presets: ['logger.js', ...OBJECT_PIPE_PRESETS]
  },
  {
    id: 'canvas-widgets',
    name: 'Canvas Widgets',
    description: 'Interactive widgets you can play with',
    icon: 'Layout',
    requiredObjects: ['canvas.dom'],
    presets: [
      'xy-pad.canvas',
      'hsla.picker',
      'rgba.picker',
      'plotter.canvas',
      'particle.canvas',
      'midi.keyboard',
      'fractal-tree.canvas'
    ]
  },
  {
    id: 'hydra-operators',
    name: 'Hydra Operators',
    description: 'Video operators built with Hydra',
    icon: 'Palette',
    requiredObjects: ['hydra'],
    presets: ['add.hydra', 'diff.hydra', 'sub.hydra', 'blend.hydra', 'mask.hydra']
  },
  {
    id: 'texture-generators',
    name: 'Texture Generators',
    description: 'Procedural sources for starting visual chains',
    icon: 'Shapes',
    requiredObjects: ['glsl'],
    presets: [
      'Constant',
      'Linear Ramp',
      'Radial Ramp',
      'Circular Ramp',
      'Noise',
      'Circle',
      'Rectangle',
      'Cross'
    ]
  },
  {
    id: 'texture-composite',
    name: 'Texture Composite',
    description: 'Combine and switch between multiple textures',
    icon: 'ArrowRightLeft',
    requiredObjects: ['glsl', 'regl'],
    presets: [
      'Mix',
      'Multiply',
      'Add',
      'Subtract',
      'Difference',
      'Math',
      'Composite',
      'Over',
      'Under',
      'Layout',
      'Layer',
      'Switcher'
    ]
  },
  {
    id: 'texture-time',
    name: 'Texture Time',
    description: 'Feedback and frame-history utilities',
    icon: 'Clock',
    requiredObjects: ['glsl', 'regl'],
    presets: ['Feedback', 'Cache', 'Time Scrub', 'Time Machine']
  },
  {
    id: 'texture-color',
    name: 'Texture Color',
    description: 'Color correction and channel utilities',
    icon: 'Palette',
    requiredObjects: ['glsl'],
    presets: [
      'Level',
      'Luma Level',
      'HSV Adjust',
      'Monochrome',
      'Channel Mix',
      'Pack',
      'Limit',
      'Remap',
      'Lookup',
      'RGB to HSV',
      'HSV to RGB',
      'Tone Map',
      'Reorder'
    ]
  },
  {
    id: 'texture-masks-keys',
    name: 'Texture Masks & Keys',
    description: 'Build and apply alpha and matte textures',
    icon: 'Eye',
    requiredObjects: ['glsl'],
    presets: ['Threshold', 'Chroma Key', 'RGB Key', 'Luma Key', 'Matte']
  },
  {
    id: 'texture-transform',
    name: 'Texture Transform',
    description: 'Move, crop, tile, and warp textures',
    icon: 'Route',
    requiredObjects: ['glsl'],
    presets: [
      'Transform',
      'Crop',
      'Fit',
      'Flip',
      'Mirror',
      'Tile',
      'Lens Distort',
      'Displace',
      'Noise Displace'
    ]
  },
  {
    id: 'texture-filters',
    name: 'Texture Filters',
    description: 'Image-processing effects for texture chains',
    icon: 'SlidersHorizontal',
    requiredObjects: ['glsl', 'regl'],
    presets: [
      'Blur',
      'Luma Blur',
      'Bloom',
      'Convolve',
      'Edge',
      'Anti Alias',
      'Emboss',
      'Slope',
      'Normal Map'
    ]
  },
  {
    id: 'scripting-demos',
    name: 'Scripting Demos',
    description: 'JS scripts for control flow',
    icon: 'Code',
    requiredObjects: ['js'],
    presets: ['delay.js']
  },
  {
    id: 'iframe-widgets',
    name: 'Iframe Widgets',
    description: 'Useful widgets made with iframes',
    icon: 'Layout',
    requiredObjects: ['iframe', 'dom'],
    presets: ['youtube.iframe', 'bitmaprenderer']
  },
  {
    id: 'midi',
    name: 'MIDI Utilities',
    description: 'Scripts and controls for MIDI',
    icon: 'Music',
    requiredObjects: ['js', 'slider', 'knob'],
    presets: ['midi-adsr.js', 'midi.slider', 'midi.knob']
  },
  {
    id: 'timing-demos',
    name: 'Timing Demos',
    description: 'JS scripts for frame-based timing',
    icon: 'Clock',
    requiredObjects: ['js'],
    presets: ['bang-every-frame.js', 'frame-counter.js', 'interval.js']
  },
  {
    id: 'p5-demos',
    name: 'P5.js Demos',
    description: 'Examples for using P5 for 2D graphics',
    icon: 'Palette',
    requiredObjects: ['p5'],
    presets: ['bouncing-balls.p5', 'text-banner.p5', 'traffic-light.p5']
  },
  {
    id: 'scope-demos',
    name: 'Scope Demos',
    description: 'Waveform and Lissajous visualizers for tap~',
    icon: 'AudioWaveform',
    requiredObjects: ['tap~', 'canvas.dom'],
    presets: ['scope.canvas', 'scope-xy.canvas']
  },
  {
    id: 'fft-demos',
    name: 'FFT Demos',
    description: 'Audio analysis demo in various objects',
    icon: 'AudioWaveform',
    requiredObjects: ['fft~', 'js', 'p5', 'hydra', 'canvas.dom', 'glsl'],
    presets: [
      'fft.canvas',
      'fft.hydra',
      'fft.p5',
      'fft-sm.p5',
      'rms.p5',
      'rms-wide.p5',
      'FFT Frequency GL',
      'FFT Waveform GL'
    ]
  },
  {
    id: 'audio-synthesis',
    name: 'Synthesis Scripts',
    description: 'JS scripts to control synth operators',
    icon: 'AudioLines',
    requiredObjects: ['js'],
    presets: ['sawtooth-harmonics.js', 'waveshaper-distortion.js']
  },
  {
    id: 'hydra-demos',
    name: 'Hydra Demos',
    description: 'Example video synths made with Hydra',
    icon: 'Palette',
    requiredObjects: ['hydra'],
    presets: ['beans.hydra', 'filet-mignon.hydra']
  },
  {
    id: 'demo-compositions',
    name: 'Demo Compositions',
    description: 'Example music compositions from code',
    icon: 'Music',
    requiredObjects: ['strudel', 'chuck~', 'orca'],
    presets: [
      'bump-street.strudel',
      'traffic-flam.strudel',
      'funk-42.strudel',
      'bell.chuck',
      'orca.hello'
    ]
  },
  {
    id: 'three-demos',
    name: 'Three.js Demos',
    description: '3D graphics with Three.js',
    icon: 'Box',
    requiredObjects: ['three', 'glsl'],
    presets: ['video-cube.three', 'video-torus.three', 'video-sphere.three', 'crate.three']
  },
  {
    id: 'gpu-geometry',
    name: 'GPU Geometry',
    description: 'Point clouds, meshes, and position fields from textures',
    icon: 'Waypoints',
    requiredObjects: ['three', 'glsl', 'regl'],
    presets: [
      'point-cloud-from-texture.three',
      'mesh-surface-from-texture.three',
      'point-cloud-from-texture.regl',
      'Position Field',
      'Torus Position Field'
    ]
  },
  {
    id: 'tone-presets',
    name: 'Tone.js Presets',
    description: 'Audio synthesis with Tone.js',
    icon: 'AudioLines',
    requiredObjects: ['tone~'],
    presets: ['poly-synth-midi.tone', 'reverb.tone', 'lowpass.tone']
  },
  {
    id: 'asm-examples',
    name: 'Assembly Demos',
    description: 'Example programs for asm vm',
    icon: 'Cpu',
    requiredObjects: ['asm'],
    presets: [
      'echo.asm',
      'accumulator.asm',
      'double.asm',
      'threshold-gate.asm',
      'running-average.asm',
      'fibonacci.asm',
      'clamp.asm',
      'modulo-counter.asm',
      'delta.asm'
    ]
  },
  {
    id: 'supersonic-demos',
    name: 'SuperSonic Demos',
    description: 'SuperCollider synths via SuperSonic',
    icon: 'Music',
    requiredObjects: ['sonic~'],
    presets: ['sonic-prophet', 'sonic-tb303', 'sonic-sample-loop', 'sonic-multi-synth']
  },
  {
    id: 'ascii-art-demos',
    name: 'ASCII Art Demos',
    description: 'ASCII art built with textmode.js',
    icon: 'Type',
    requiredObjects: ['textmode'],
    presets: [
      'digital-rain.tm',
      'animated-wave.tm',
      'plasma-field.tm',
      'rain.tm',
      'torus.tm',
      'fire.tm'
    ]
  },
  {
    id: 'dsp-presets',
    name: 'DSP Presets',
    description: 'Audio DSP utilities and signal processing',
    icon: 'AudioLines',
    requiredObjects: ['dsp~', 'elem~', 'expr~'],
    presets: [
      'noise.dsp',
      'tabosc~',
      'lowpass.elem',
      'phasor.elem',
      'train.elem',
      'sine-osc.dsp',
      'variable-osc.dsp',
      'phasor.dsp',
      'bitcrusher.dsp',
      'hardsync.dsp'
    ]
  },
  {
    id: 'uiua-demos',
    name: 'Uiua Demos',
    description: 'Visual array programming demos with Uiua',
    icon: 'Grid3x3',
    requiredObjects: ['uiua'],
    presets: [
      'game-of-life.uiua',
      'uiua-logo.uiua',
      'sine.uiua',
      'spiral.uiua',
      'stripes.uiua',
      'cellular-automata.uiua',
      'mandelbrot.uiua'
    ]
  },
  {
    id: 'bytebeat-demos',
    name: 'Bytebeat Demos',
    description: 'Classic bytebeat formulas and demos',
    icon: 'AudioWaveform',
    requiredObjects: ['bytebeat~'],
    presets: [
      'sine-power.beat',
      'explosive.beat',
      'rickroll.beat',
      'floatbeat.beat',
      'ice-age.beat'
    ]
  },
  {
    id: 'ai-prompt-presets',
    name: 'AI Prompt Presets',
    description: 'Prompt templates for AI objects',
    icon: 'Brain',
    requiredObjects: ['ai.txt'],
    presets: ['music-from-image.prompt']
  }
];
