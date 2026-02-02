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
    id: 'scripting-samples',
    name: 'Scripting Samples',
    description: 'Example JavaScript code for patching',
    icon: 'Code',
    requiredObjects: ['js'],
    presets: ['pipe.js', 'delay.js']
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
    description: 'JS scripts for sound design',
    icon: 'AudioLines',
    requiredObjects: ['js'],
    presets: ['sawtooth-harmonics.js', 'waveshaper-distortion.js']
  },
  {
    id: 'animation',
    name: 'Animation',
    description: 'Frame-based animation helpers',
    icon: 'Palette',
    requiredObjects: ['js'],
    presets: ['bang-every-frame.js', 'frame-counter.js', 'interval.js']
  },
  {
    id: 'canvas-widgets',
    name: 'Canvas Widgets',
    description: 'Interactive canvas components',
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
    description: 'Operators built with Hydra',
    icon: 'Palette',
    requiredObjects: ['hydra'],
    presets: ['pipe.hydra', 'add.hydra', 'diff.hydra', 'sub.hydra', 'blend.hydra', 'mask.hydra']
  },
  {
    id: 'hydra-examples',
    name: 'Hydra Samples',
    description: 'Sample video synths made with Hydra',
    icon: 'Palette',
    requiredObjects: ['hydra'],
    presets: ['beans.hydra', 'filet-mignon.hydra']
  },
  {
    id: 'strudel-examples',
    name: 'Strudel Samples',
    description: 'Sample compositions made with Strudel',
    icon: 'Music',
    requiredObjects: ['strudel'],
    presets: ['bump-street.strudel', 'traffic-flam.strudel', 'funk-42.strudel']
  },
  {
    id: 'p5-examples',
    name: 'P5 Samples',
    description: 'Examples for using P5 for 2D graphics',
    icon: 'Palette',
    requiredObjects: ['p5'],
    presets: ['bouncing-balls.p5', 'cam.p5', 'slider.p5', 'text-banner.p5', 'traffic-light.p5']
  },
  {
    id: 'fft-examples',
    name: 'FFT Samples',
    description: 'Audio analysis demo in various objects',
    icon: 'AudioWaveform',
    requiredObjects: ['fft~', 'js', 'p5', 'hydra', 'canvas.dom'],
    presets: ['fft.canvas', 'fft.hydra', 'fft.p5', 'fft-sm.p5', 'rms.p5', 'rms-wide.p5', 'fft.js']
  },
  {
    id: 'iframe-widgets',
    name: 'Iframe Widgets',
    description: 'Interactive iframe components',
    icon: 'Layout',
    requiredObjects: ['iframe'],
    presets: ['youtube.iframe']
  }
];
