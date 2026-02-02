import type { PresetPack } from '../../stores/extensions.store';

/**
 * Built-in preset packs organized by use-case
 * Each preset belongs to exactly one pack (mutually exclusive)
 */
export const BUILT_IN_PRESET_PACKS: PresetPack[] = [
  {
    id: 'starter',
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
    id: 'audio-synthesis',
    name: 'Synthesis Scripts',
    description: 'JS scripts to control synth operators',
    icon: 'AudioLines',
    requiredObjects: ['js'],
    presets: ['sawtooth-harmonics.js', 'waveshaper-distortion.js']
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
    id: 'hydra-demos',
    name: 'Hydra Demos',
    description: 'Sample video synths made with Hydra',
    icon: 'Palette',
    requiredObjects: ['hydra'],
    presets: ['beans.hydra', 'filet-mignon.hydra']
  },
  {
    id: 'strudel-demos',
    name: 'Strudel Demos',
    description: 'Sample compositions made with Strudel',
    icon: 'Music',
    requiredObjects: ['strudel'],
    presets: ['bump-street.strudel', 'traffic-flam.strudel', 'funk-42.strudel']
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
    requiredObjects: ['fft~', 'js', 'p5', 'hydra', 'canvas.dom'],
    presets: ['fft.canvas', 'fft.hydra', 'fft.p5', 'fft-sm.p5', 'rms.p5', 'rms-wide.p5', 'fft.js']
  }
];
