import type { SettingsSchema } from '$lib/settings';
import type { GmProgramSource } from './gm-channel-state';
import { DRUM_MACHINE_INSTRUMENTS, SOUNDFONT_KITS } from './descriptors';

export const GM_DEFAULT_SETTINGS = {
  source: 'soundfont' satisfies GmProgramSource,
  kit: 'MusyngKite',
  drumInstrument: 'TR-808',
  instrumentUrl: '',
  url: '',
  volume: 100,
  velocity: 100
};

export const GM_SETTINGS_SCHEMA: SettingsSchema = [
  {
    key: 'source',
    label: 'Source',
    type: 'select',
    options: [
      { label: 'Soundfont', value: 'soundfont' },
      { label: 'Soundfont2', value: 'soundfont2' }
    ],
    default: GM_DEFAULT_SETTINGS.source
  },
  {
    key: 'kit',
    label: 'Soundfont Kit',
    type: 'select',
    options: SOUNDFONT_KITS,
    default: GM_DEFAULT_SETTINGS.kit,
    visibleWhen: { key: 'source', equals: 'soundfont' }
  },
  {
    key: 'instrumentUrl',
    label: 'Instrument URL',
    type: 'string',
    default: GM_DEFAULT_SETTINGS.instrumentUrl,
    placeholder: 'https://example.com/piano-mp3.js',
    description: 'Used when Source is Soundfont and Soundfont Kit is Custom.',
    visibleWhen: {
      all: [
        { key: 'source', equals: 'soundfont' },
        { key: 'kit', equals: 'Custom' }
      ]
    }
  },
  {
    key: 'drumInstrument',
    label: 'Drum Instrument',
    type: 'select',
    options: DRUM_MACHINE_INSTRUMENTS,
    default: GM_DEFAULT_SETTINGS.drumInstrument,
    description: 'Used for channel 10 percussion when Source is Soundfont and Kit is not Custom.',
    visibleWhen: { key: 'source', equals: 'soundfont' }
  },
  {
    key: 'url',
    label: 'SF2 URL',
    type: 'string',
    default: GM_DEFAULT_SETTINGS.url,
    placeholder: 'https://example.com/general-midi.sf2',
    visibleWhen: { key: 'source', equals: 'soundfont2' }
  },
  {
    key: 'volume',
    label: 'Volume',
    type: 'slider',
    min: 0,
    max: 127,
    step: 1,
    default: GM_DEFAULT_SETTINGS.volume
  },
  {
    key: 'velocity',
    label: 'Velocity',
    type: 'slider',
    min: 0,
    max: 127,
    step: 1,
    default: GM_DEFAULT_SETTINGS.velocity
  }
];

export function getGmDisplayName(settings: Record<string, unknown>): string {
  if (settings.source === 'soundfont2') return 'multi-channel SF2';
  if (settings.kit === 'Custom') return 'custom soundfont';

  const kit = typeof settings.kit === 'string' && settings.kit ? settings.kit : 'MusyngKite';
  return `multi-channel ${kit}`;
}
