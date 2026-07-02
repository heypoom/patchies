import type { SettingsSchema } from '$lib/settings';
import {
  GENERAL_MIDI_SOUNDFONT_PROGRAMS,
  getGeneralMidiProgramName,
  getSoundfont2ProgramName
} from './programs';

export const SMPLR_OBJECT_TYPES = [
  'soundfont~',
  'soundfont2~',
  'piano~',
  'epiano~',
  'drums~',
  'mallet~',
  'mellotron~',
  'versilian~',
  'smolken~'
] as const;

export type SmplrObjectType = (typeof SMPLR_OBJECT_TYPES)[number];

export type SmplrModule = typeof import('smplr');

export type SmplrInstrument = {
  ready: Promise<void>;
  start(event: {
    note: number | string;
    velocity?: number;
    time?: number;
    duration?: number | null;
  }): unknown;
  stop(target?: { stopId?: number | string; time?: number } | number | string): void;
  setCC(control: number, value: number): void;
  setDetune(value: number): void;
  setReverse(value: boolean): void;
  output: {
    volume: number;
    pan?: number;
  };
  dispose?: () => void;
  disconnect?: () => void;
  instrumentNames?: string[];
  loadInstrument?: (instrumentName: string) => Promise<void>;
};

export type SmplrLoadStatus = {
  loaded: number;
  total: number;
};

export type SmplrInstrumentDescriptor = {
  type: SmplrObjectType;
  title: string;
  description: string;
  defaultSettings: Record<string, unknown>;
  settingsSchema: SettingsSchema;
  reloadsOnSettings: string[];
  defaultBangNote: number | string;
  defaultVelocity: number;
  getDisplayName(settings: Record<string, unknown>): string;
  loadInstrument(args: {
    module: SmplrModule;
    context: AudioContext;
    destination: AudioNode;
    settings: Record<string, unknown>;
    onLoadProgress: (progress: SmplrLoadStatus) => void;
  }): Promise<SmplrInstrument>;
  getInstrumentNames?: (module: SmplrModule) => Promise<string[]>;
  handleProgramChange?: (
    program: number,
    settings: Record<string, unknown>
  ) => Record<string, unknown> | null;
};

const commonSettings: SettingsSchema = [
  { key: 'volume', label: 'Volume', type: 'slider', min: 0, max: 127, step: 1, default: 100 },
  {
    key: 'velocity',
    label: 'Velocity',
    type: 'slider',
    min: 0,
    max: 127,
    step: 1,
    default: 100
  },
  { key: 'pan', label: 'Pan', type: 'slider', min: -1, max: 1, step: 0.01, default: 0 },
  { key: 'defaultNote', label: 'Default Note', type: 'string', default: '60' },
  { key: 'detune', label: 'Detune', type: 'number', step: 1, default: 0 },
  { key: 'reverse', label: 'Reverse', type: 'boolean', default: false }
];

const soundfontInstruments = [...GENERAL_MIDI_SOUNDFONT_PROGRAMS];
const SOUNDFONT_CUSTOM_KIT = 'Custom';
export const SOUNDFONT_KITS = ['MusyngKite', 'FluidR3_GM', 'FatBoy', SOUNDFONT_CUSTOM_KIT];
const electricPianos = ['CP80', 'PianetT', 'WurlitzerEP200', 'TX81Z'];
export const DRUM_MACHINE_INSTRUMENTS = [
  'TR-808',
  'Casio-RZ1',
  'LM-2',
  'MFB-512',
  'Roland CR-8000'
];
const mallets = [
  'Balafon - Hard Mallet',
  'Balafon - Keyswitch',
  'Balafon - Soft Mallet',
  'Balafon - Traditional Mallet',
  'Tubular Bells 1',
  'Tubular Bells 2',
  'Vibraphone - Bowed',
  'Vibraphone - Hard Mallets',
  'Vibraphone - Keyswitch',
  'Vibraphone - Soft Mallets',
  'Xylophone - Hard Mallets',
  'Xylophone - Keyswitch',
  'Xylophone - Medium Mallets',
  'Xylophone - Soft Mallets'
];
const mellotrons = [
  '300 STRINGS CELLO',
  '300 STRINGS VIOLA',
  '8VOICE CHOIR',
  'BASSA+STRNGS',
  'BOYS CHOIR',
  'CHMBLN FLUTE',
  'MKII BRASS',
  'MKII GUITAR',
  'MKII ORGAN',
  'MKII SAX',
  'MKII VIOLINS',
  'TRON CELLO',
  'TRON FLUTE',
  'TRON VIOLA'
];
const smolkenNames = ['Pizzicato', 'Arco', 'Switched'];
const versilianDefaultInstrument = 'Electrophones/TX81Z - FM Piano';

function commonOptions(
  destination: AudioNode,
  settings: Record<string, unknown>,
  onLoadProgress: (progress: SmplrLoadStatus) => void
) {
  return {
    destination,
    volume: numberSetting(settings.volume, 100),
    velocity: numberSetting(settings.velocity, 100),
    pan: numberSetting(settings.pan, 0),
    onLoadProgress
  };
}

function descriptor(
  config: Omit<SmplrInstrumentDescriptor, 'defaultVelocity'>
): SmplrInstrumentDescriptor {
  return { ...config, defaultVelocity: 100 };
}

type SelectableInstrumentOptions = ReturnType<typeof commonOptions> & {
  instrument: string;
};

export const smplrDescriptors: Record<SmplrObjectType, SmplrInstrumentDescriptor> = {
  'soundfont~': descriptor({
    type: 'soundfont~',
    title: 'soundfont~',
    description: 'General MIDI Soundfont instrument for MIDI note messages',
    defaultBangNote: '60',
    defaultSettings: {
      instrument: 'acoustic_grand_piano',
      kit: 'MusyngKite',
      instrumentUrl: '',
      loadLoopData: false,
      volume: 100,
      velocity: 100,
      pan: 0,
      defaultNote: '60',
      detune: 0,
      reverse: false
    },
    settingsSchema: [
      {
        key: 'instrument',
        label: 'Instrument',
        type: 'combobox',
        options: soundfontInstruments,
        default: 'acoustic_grand_piano',
        searchPlaceholder: 'Search General MIDI instruments...',
        emptyMessage: 'No instrument found.'
      },
      { key: 'kit', label: 'Kit', type: 'select', options: SOUNDFONT_KITS, default: 'MusyngKite' },
      {
        key: 'instrumentUrl',
        label: 'Instrument URL',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/piano-mp3.js',
        description: 'Used when Kit is Custom. Expects a MIDI.js soundfont file URL.',
        visibleWhen: { key: 'kit', equals: SOUNDFONT_CUSTOM_KIT }
      },
      { key: 'loadLoopData', label: 'Load Loop Data', type: 'boolean', default: false },
      ...commonSettings
    ],
    reloadsOnSettings: ['instrument', 'kit', 'instrumentUrl', 'loadLoopData'],
    getDisplayName: (settings) => getSoundfontDisplayName(settings),
    loadInstrument: async ({ module, context, destination, settings, onLoadProgress }) => {
      const kit = stringSetting(settings.kit, 'MusyngKite');
      const instrumentUrl = stringSetting(settings.instrumentUrl, '').trim();
      if (kit === SOUNDFONT_CUSTOM_KIT && !instrumentUrl) {
        throw new Error('Set an Instrument URL when Kit is Custom');
      }

      const customOptions = kit === SOUNDFONT_CUSTOM_KIT ? { instrumentUrl } : {};
      const instrument = module.Soundfont(context, {
        ...commonOptions(destination, settings, onLoadProgress),
        ...customOptions,
        ...(kit === SOUNDFONT_CUSTOM_KIT
          ? {}
          : {
              instrument: stringSetting(settings.instrument, 'acoustic_grand_piano'),
              kit
            }),
        loadLoopData: booleanSetting(settings.loadLoopData, false)
      });
      await instrument.ready;
      return instrument;
    },
    handleProgramChange: (program, settings) => {
      if (stringSetting(settings.kit, 'MusyngKite') === SOUNDFONT_CUSTOM_KIT) return null;

      const instrument = getGeneralMidiProgramName(program);
      return instrument ? { instrument } : null;
    }
  }),

  'soundfont2~': descriptor({
    type: 'soundfont2~',
    title: 'soundfont2~',
    description: 'Load a SoundFont2 SF2 file and play its instruments from MIDI messages',
    defaultBangNote: '60',
    defaultSettings: {
      url: '',
      instrument: '',
      instrumentNames: [],
      volume: 100,
      velocity: 100,
      pan: 0,
      defaultNote: '60',
      detune: 0,
      reverse: false
    },
    settingsSchema: [
      {
        key: 'url',
        label: 'SF2 URL',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/instrument.sf2'
      },
      {
        key: 'instrument',
        label: 'Instrument',
        type: 'combobox',
        options: [],
        default: '',
        placeholder: 'Load an SF2 file first',
        searchPlaceholder: 'Search SF2 instruments...',
        emptyMessage: 'No instrument found.'
      },
      ...commonSettings
    ],
    reloadsOnSettings: ['url', 'instrument'],
    getDisplayName: (settings) => stringSetting(settings.instrument, 'SF2 instrument'),
    loadInstrument: async ({ module, context, destination, settings, onLoadProgress }) => {
      const url = stringSetting(settings.url, '');
      if (!url) throw new Error('Set an SF2 URL in settings');

      const { SoundFont2 } = await import('soundfont2');
      const instrument = module.Soundfont2(context, {
        ...commonOptions(destination, settings, onLoadProgress),
        url,
        createSoundfont: (data) => new SoundFont2(data)
      });

      await instrument.ready;
      const instrumentName =
        stringSetting(settings.instrument, '') || instrument.instrumentNames[0] || '';
      if (instrumentName) await instrument.loadInstrument(instrumentName);
      return instrument;
    },
    handleProgramChange: (program, settings) => {
      const names = Array.isArray(settings.instrumentNames)
        ? settings.instrumentNames.filter((name): name is string => typeof name === 'string')
        : [];
      const instrument = getSoundfont2ProgramName(program, names);
      return instrument ? { instrument } : null;
    }
  }),

  'piano~': descriptor({
    type: 'piano~',
    title: 'piano~',
    description: 'Splendid Grand Piano sampled instrument',
    defaultBangNote: '60',
    defaultSettings: {
      decayTime: 0.5,
      volume: 100,
      velocity: 100,
      pan: 0,
      defaultNote: '60',
      detune: 0,
      reverse: false
    },
    settingsSchema: [
      { key: 'decayTime', label: 'Decay Time', type: 'number', min: 0, step: 0.05, default: 0.5 },
      ...commonSettings
    ],
    reloadsOnSettings: ['decayTime'],
    getDisplayName: () => 'Splendid Grand Piano',
    loadInstrument: async ({ module, context, destination, settings, onLoadProgress }) => {
      const instrument = module.SplendidGrandPiano(context, {
        ...commonOptions(destination, settings, onLoadProgress),
        decayTime: numberSetting(settings.decayTime, 0.5),
        detune: numberSetting(settings.detune, 0)
      });
      await instrument.ready;
      return instrument;
    }
  }),

  'epiano~': selectableInstrumentDescriptor(
    'epiano~',
    'Electric piano sampled instrument',
    electricPianos,
    'CP80',
    (module, context, options) => module.ElectricPiano(context, options)
  ),
  'drums~': selectableInstrumentDescriptor(
    'drums~',
    'Classic drum machine sampled instrument',
    DRUM_MACHINE_INSTRUMENTS,
    'TR-808',
    (module, context, options) => module.DrumMachine(context, options),
    '36'
  ),
  'mallet~': selectableInstrumentDescriptor(
    'mallet~',
    'Mallet sampled instrument',
    mallets,
    'Vibraphone - Hard Mallets',
    (module, context, options) => module.Mallet(context, options)
  ),
  'mellotron~': selectableInstrumentDescriptor(
    'mellotron~',
    'Mellotron archive sampled instrument',
    mellotrons,
    'MKII VIOLINS',
    (module, context, options) => module.Mellotron(context, options)
  ),
  'versilian~': selectableInstrumentDescriptor(
    'versilian~',
    'Versilian Community Sample Library instrument',
    [versilianDefaultInstrument],
    versilianDefaultInstrument,
    (module, context, options) => module.Versilian(context, options),
    '60',
    (module) => module.getVersilianInstruments()
  ),
  'smolken~': selectableInstrumentDescriptor(
    'smolken~',
    'Smolken double bass sampled instrument',
    smolkenNames,
    'Arco',
    (module, context, options) => module.Smolken(context, options)
  )
};

export function getSmplrDescriptor(type: SmplrObjectType): SmplrInstrumentDescriptor {
  return smplrDescriptors[type];
}

function selectableInstrumentDescriptor(
  type: SmplrObjectType,
  description: string,
  instruments: string[],
  defaultInstrument: string,
  factory: (
    module: SmplrModule,
    context: AudioContext,
    options: SelectableInstrumentOptions
  ) => SmplrInstrument,
  defaultBangNote: number | string = '60',
  getInstrumentNames?: (module: SmplrModule) => Promise<string[]>
): SmplrInstrumentDescriptor {
  return descriptor({
    type,
    title: type,
    description,
    defaultBangNote,
    defaultSettings: {
      instrument: defaultInstrument,
      volume: 100,
      velocity: 100,
      pan: 0,
      defaultNote: String(defaultBangNote),
      detune: 0,
      reverse: false
    },
    settingsSchema: [
      {
        key: 'instrument',
        label: 'Instrument',
        type: 'combobox',
        options: instruments,
        default: defaultInstrument,
        searchPlaceholder: 'Search instruments...',
        emptyMessage: 'No instrument found.'
      },
      ...commonSettings
    ],
    reloadsOnSettings: ['instrument'],
    getDisplayName: (settings) => stringSetting(settings.instrument, defaultInstrument),
    getInstrumentNames,
    loadInstrument: async ({ module, context, destination, settings, onLoadProgress }) => {
      const instrument = factory(module, context, {
        ...commonOptions(destination, settings, onLoadProgress),
        instrument: stringSetting(settings.instrument, defaultInstrument)
      });
      await instrument.ready;
      return instrument;
    }
  });
}

function stringSetting(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function numberSetting(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getSoundfontDisplayName(settings: Record<string, unknown>): string {
  const kit = stringSetting(settings.kit, 'MusyngKite');
  const instrumentUrl = stringSetting(settings.instrumentUrl, '').trim();
  if (kit !== SOUNDFONT_CUSTOM_KIT || !instrumentUrl) {
    return stringSetting(settings.instrument, 'acoustic_grand_piano');
  }

  const lastPathPart = instrumentUrl.split(/[/?#]/).filter(Boolean).at(-1);
  return lastPathPart || 'Custom Soundfont';
}
