import type { PresetPack } from '../../stores/extensions.store';

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
    requiredObjects: ['js'],
    presets: ['logger.js']
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
      'midi.keyboard'
    ]
  },
  {
    id: 'hydra-operators',
    name: 'Hydra Operators',
    description: 'Video operators built with Hydra',
    icon: 'Palette',
    requiredObjects: ['hydra'],
    presets: ['pipe.hydra', 'add.hydra', 'diff.hydra', 'sub.hydra', 'blend.hydra', 'mask.hydra']
  },
  {
    id: 'glsl-presets',
    name: 'GLSL Operators',
    description: 'Video operators built with GLSL',
    icon: 'Shapes',
    requiredObjects: ['glsl'],
    presets: ['mix.gl', 'pipe.gl', 'overlay.gl', 'switcher.gl', 'red.gl']
  },
  {
    id: 'scripting-demos',
    name: 'Scripting Demos',
    description: 'JS scripts for control flow',
    icon: 'Code',
    requiredObjects: ['js'],
    presets: ['pipe.js', 'delay.js']
  },
  {
    id: 'iframe-widgets',
    name: 'Iframe Widgets',
    description: 'Useful widgets made with iframes',
    icon: 'Layout',
    requiredObjects: ['iframe'],
    presets: ['youtube.iframe']
  },
  {
    id: 'midi',
    name: 'MIDI Scripts',
    description: 'JS scripts for automating MIDI',
    icon: 'Music',
    requiredObjects: ['js', 'slider'],
    presets: ['midi-adsr-gain.js', 'midi-control-router.js', 'midi.slider']
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
    presets: ['bouncing-balls.p5', 'cam.p5', 'slider.p5', 'text-banner.p5', 'traffic-light.p5']
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
      'fft-freq.gl',
      'fft-waveform.gl',
      'fft.js'
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
    id: 'dsp-presets',
    name: 'DSP Presets',
    description: 'Audio DSP utilities and signal processing',
    icon: 'AudioLines',
    requiredObjects: ['dsp~', 'elem~', 'expr~'],
    presets: [
      'bang~',
      'noise~',
      'snapshot~',
      'lowpass.elem',
      'phasor.elem',
      'train.elem',
      'sine-osc.dsp',
      'bitcrusher.dsp'
    ]
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
    id: 'three-demos',
    name: 'Three.js Demos',
    description: '3D graphics with Three.js',
    icon: 'Box',
    requiredObjects: ['three'],
    presets: ['video-cube.three', 'video-torus.three', 'video-sphere.three', 'crate.three']
  },
  {
    id: 'tone-presets',
    name: 'Tone.js Presets',
    description: 'Audio synthesis with Tone.js',
    icon: 'AudioLines',
    requiredObjects: ['tone~'],
    presets: ['poly-synth-midi.tone', 'pipe.tone', 'reverb.tone', 'lowpass.tone']
  }
];
