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
  showWaveform: boolean;
}

/** MIDI note for pad 1 (GM: Bass Drum 1) */
export const BASE_NOTE = 36;

/** GM drum names keyed by MIDI note number */
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

/** Abbreviated GM drum names for compact display */
export const GM_DRUM_SHORT: Record<number, string> = {
  36: 'KCK',
  37: 'STK',
  38: 'SNR',
  39: 'CLP',
  40: 'ESN',
  41: 'LFT',
  42: 'CHH',
  43: 'HFT',
  44: 'PHH',
  45: 'LTM',
  46: 'OHH',
  47: 'LMT',
  48: 'HMT',
  49: 'CRS',
  50: 'HTM',
  51: 'RDE'
};

export const DEFAULT_PADS_NODE_DATA: PadsNodeData = {
  padCount: 16,
  pads: Array.from({ length: 16 }, () => ({})),
  maxVoices: 4,
  noteOffMode: 'ignore',
  showGmLabels: true,
  showWaveform: true
};

export const PADS_MIN_WIDTH = 160;
export const PADS_MIN_HEIGHT = 100;
export const PADS_DEFAULT_WIDTH = 280;
export const PADS_DEFAULT_HEIGHT = 300;
