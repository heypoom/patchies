import type { PresetPack } from '../../stores/extensions.store';

/**
 * Built-in preset packs organized by use-case
 * Each preset belongs to exactly one pack (mutually exclusive)
 */
export const BUILT_IN_PRESET_PACKS: PresetPack[] = [
  {
    id: 'starter',
    name: 'Starter Presets',
    description: 'Essential presets for getting started',
    icon: 'Sparkles',
    requiredObjects: ['js'],
    presets: ['logger.js']
  },
  {
    id: 'midi',
    name: 'MIDI Scripts',
    description: 'JS scripts for automating MIDI',
    icon: 'Music',
    requiredObjects: ['js'],
    presets: ['midi-adsr-gain.js', 'midi-control-router.js']
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
      'fft.canvas',
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
    id: 'livecoding-examples',
    name: 'Livecoding Examples',
    description: 'Example patches for livecoding',
    icon: 'Music',
    requiredObjects: ['strudel', 'orca'],
    presets: ['bump-street.strudel', 'traffic-flam.strudel', 'funk-42.strudel']
  }
];
