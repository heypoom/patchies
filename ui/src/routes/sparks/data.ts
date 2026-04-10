import type { Mood, Output } from './types';

export const moods: Mood[] = [
  {
    id: 'dark',
    name: 'Dark',
    tagline: 'Heavy. Slow. Threatening.',
    description:
      'Deep bass drones that fill a room. Monochrome visuals that shift like smoke. The kind of patch that makes people uncomfortable in the best way.',
    nodes: ['osc~', 'glsl', 'lfo'],
    gradient: 'linear-gradient(135deg, #0a0a1a 0%, #1a1030 50%, #0d0d1a 100%)',
    accentColor: '#818cf8',
    glowColor: 'rgba(99, 102, 241, 0.15)',
    textColor: '#c7d2fe'
  },
  {
    id: 'euphoric',
    name: 'Euphoric',
    tagline: 'Bright. Fast. Alive.',
    description:
      'Festival energy in a patch. Audio-reactive explosions of color, strudel patterns that accelerate, visuals that peak with the drop.',
    nodes: ['fft~', 'strudel', 'p5'],
    gradient: 'linear-gradient(135deg, #1a0f00 0%, #2d1a00 50%, #1a1200 100%)',
    accentColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.15)',
    textColor: '#fde68a'
  },
  {
    id: 'glitchy',
    name: 'Glitchy',
    tagline: 'Broken. Wrong. Perfect.',
    description:
      'Corrupted video feeds, stuttering audio, visuals that fight against themselves. Deliberately malfunctioning systems are the most interesting ones.',
    nodes: ['glsl', 'webcam', 'js'],
    gradient: 'linear-gradient(135deg, #000d00 0%, #001a04 50%, #000e00 100%)',
    accentColor: '#4ade80',
    glowColor: 'rgba(74, 222, 128, 0.12)',
    textColor: '#86efac'
  },
  {
    id: 'meditative',
    name: 'Meditative',
    tagline: 'Slow. Looping. Breathable.',
    description:
      'Long reverb tails that blur into silence. Hydra visuals that drift without destination. Time stretches. The patch breathes on its own.',
    nodes: ['hydra', 'reverb~', 'lfo'],
    gradient: 'linear-gradient(135deg, #001214 0%, #001e20 50%, #001012 100%)',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.1)',
    textColor: '#a5f3fc'
  },
  {
    id: 'chaotic',
    name: 'Chaotic',
    tagline: 'Too much. All at once.',
    description:
      "Every frequency band triggering something different. DMX strobing. Strudel patterns racing. Controlled overwhelm — the audience doesn't know where to look.",
    nodes: ['fft', 'serial.dmx', 'strudel'],
    gradient: 'linear-gradient(135deg, #1a0000 0%, #2d0000 50%, #1a0500 100%)',
    accentColor: '#f87171',
    glowColor: 'rgba(248, 113, 113, 0.14)',
    textColor: '#fca5a5'
  },
  {
    id: 'dreamy',
    name: 'Dreamy',
    tagline: 'Soft. Drifting. Hazy.',
    description:
      'Delay trails that smear the past into the present. Hydra textures like oil on water. Something ambient that forgets it started.',
    nodes: ['hydra', 'delay~', 'p5'],
    gradient: 'linear-gradient(135deg, #0d0014 0%, #160020 50%, #0a0012 100%)',
    accentColor: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.12)',
    textColor: '#e9d5ff'
  },
  {
    id: 'industrial',
    name: 'Industrial',
    tagline: 'Mechanical. Rhythmic. Cold.',
    description:
      'Clock-driven light rigs, oscillators that clank rather than sing. The beauty of machinery doing exactly what it was told.',
    nodes: ['serial.dmx', 'osc~', 'transport'],
    gradient: 'linear-gradient(135deg, #0f0d0a 0%, #1a1610 50%, #100e0a 100%)',
    accentColor: '#fb923c',
    glowColor: 'rgba(249, 115, 22, 0.12)',
    textColor: '#fed7aa'
  },
  {
    id: 'playful',
    name: 'Playful',
    tagline: 'Interactive. Light. Joyful.',
    description:
      'Sliders that feel good to touch. Canvases that react to cursor position. Patches that invite people to break them.',
    nodes: ['p5', 'slider', 'canvas'],
    gradient: 'linear-gradient(135deg, #0a1200 0%, #111e00 50%, #0b1300 100%)',
    accentColor: '#a3e635',
    glowColor: 'rgba(163, 230, 53, 0.12)',
    textColor: '#d9f99d'
  }
];

export const outputs: Output[] = [
  {
    id: '2d-visual',
    name: '2D Visual',
    description: 'Canvas, P5.js, generative graphics',
    packIds: ['2d']
  },
  {
    id: 'video',
    name: 'Video',
    description: 'Three.js, Hydra, shaders, projection',
    packIds: ['video-synthesis']
  },
  {
    id: 'sound',
    name: 'Sound',
    description: 'Synthesis, effects, audio processing',
    packIds: ['signal-generators', 'audio-effects']
  },
  {
    id: 'music',
    name: 'Music',
    description: 'Composition, patterns, sequencing',
    packIds: ['music'],
    nodes: ['bytebeat~']
  },
  {
    id: 'gestures',
    name: 'Gestures',
    description: 'Webcam, body & hand tracking',
    packIds: ['vision'],
    nodes: ['webcam']
  },
  {
    id: 'code',
    name: 'Code',
    description: 'JS runners, workers, scripting',
    packIds: ['scripting'],
    nodes: ['js', 'worker']
  },
  {
    id: 'low-level',
    name: 'Low-Level',
    description: 'VMs, assembly, bytecode',
    packIds: ['low-level'],
    nodes: ['wgpu.compute']
  },
  {
    id: 'dsp',
    name: 'DSP',
    description: 'Custom signal processors & audio math',
    packIds: ['signal-processors']
  },
  {
    id: 'lighting',
    name: 'Lighting',
    description: 'DMX lights & LED strips',
    nodes: ['serial.dmx']
  },
  {
    id: 'projection',
    name: 'Projection',
    description: 'Projection mapping',
    nodes: ['projmap']
  },
  {
    id: 'midi',
    name: 'MIDI',
    description: 'MIDI controllers & instruments',
    packIds: ['midi']
  },
  {
    id: 'serial',
    name: 'Serial',
    description: 'Arduino, sensors, physical I/O',
    nodes: ['serial', 'serial.term']
  }
];
