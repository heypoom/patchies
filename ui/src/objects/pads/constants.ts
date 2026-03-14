export type PadCount = 8 | 16;
export type NoteOffMode = 'ignore' | 'stop';

export interface PadConfig {
  vfsPath?: string;
  label?: string;
}

export interface PadsNodeData {
  padCount: PadCount;
  pads: PadConfig[];
  maxVoices: number;
  noteOffMode: NoteOffMode;
  showGmLabels: boolean;
}

/** MIDI note for pad 1 (GM: Bass Drum 1) */
export const BASE_NOTE = 36;

/** Short GM drum names keyed by MIDI note number */
export const GM_DRUM_NAMES: Record<number, string> = {
  36: 'Kick',
  37: 'Side Stick',
  38: 'Snare',
  39: 'Clap',
  40: 'E. Snare',
  41: 'Lo Floor Tom',
  42: 'Closed HH',
  43: 'Hi Floor Tom',
  44: 'Pedal HH',
  45: 'Low Tom',
  46: 'Open HH',
  47: 'Lo-Mid Tom',
  48: 'Hi-Mid Tom',
  49: 'Crash',
  50: 'High Tom',
  51: 'Ride'
};

export const DEFAULT_PADS_NODE_DATA: PadsNodeData = {
  padCount: 16,
  pads: Array.from({ length: 16 }, () => ({})),
  maxVoices: 4,
  noteOffMode: 'ignore',
  showGmLabels: true
};

export const PADS_MIN_WIDTH = 240;
export const PADS_MIN_HEIGHT = 180;
export const PADS_DEFAULT_WIDTH = 280;
export const PADS_DEFAULT_HEIGHT = 300;
