import { getGeneralMidiProgramName, getSoundfont2ProgramName } from './programs';

export type GmProgramSource = 'soundfont' | 'soundfont2';

export type GmChannelState = {
  programs: number[];
};

const MIDI_CHANNEL_COUNT = 16;

export function createGmChannelState(defaultProgram = 0): GmChannelState {
  return {
    programs: Array.from({ length: MIDI_CHANNEL_COUNT }, () => defaultProgram)
  };
}

export function normalizeMidiChannel(channel: unknown): number {
  if (typeof channel !== 'number' || !Number.isFinite(channel)) return 1;

  return Math.max(1, Math.min(MIDI_CHANNEL_COUNT, Math.round(channel)));
}

export function getChannelProgram(state: GmChannelState, channel: unknown): number {
  return state.programs[normalizeMidiChannel(channel) - 1] ?? 0;
}

export function setChannelProgram(state: GmChannelState, channel: unknown, program: number): void {
  state.programs[normalizeMidiChannel(channel) - 1] = Math.max(0, Math.round(program));
}

export function resolveGmProgramInstrument(
  source: GmProgramSource,
  program: number,
  soundfont2Names: string[]
): string | null {
  if (!Number.isInteger(program) || program < 0 || program > 127) return null;

  if (source === 'soundfont') return getGeneralMidiProgramName(program) ?? null;

  return getSoundfont2ProgramName(program, soundfont2Names) ?? null;
}
