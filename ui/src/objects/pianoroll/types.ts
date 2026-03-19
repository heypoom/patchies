export type PianoRollMode = 'idle' | 'armed' | 'recording' | 'playing' | 'looping';
export type PianoRollQuantize = 'off' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2';

export interface PianoRollNote {
  tick: number; // start tick (relative to clip start, PPQ=480)
  durationTicks: number; // duration in ticks
  note: number; // MIDI note 0-127
  velocity: number; // 0-127
  channel: number; // 1-16
}

export interface PianoRollNodeData {
  notes: PianoRollNote[];
  mode: PianoRollMode;
  lengthBars: number; // 1 | 2 | 4 | 8 | 16
  loop: boolean;
  syncToTransport: boolean;
  quantize: PianoRollQuantize;
  scrollNote: number; // lowest visible note (default 48 = C3)
  zoom: number; // pixels per beat (default 60)
}

export const PPQ = 480;

export const QUANTIZE_TICKS: Record<string, number> = {
  '1/32': PPQ / 8, // 60
  '1/16': PPQ / 4, // 120
  '1/8': PPQ / 2, // 240
  '1/4': PPQ, // 480
  '1/2': PPQ * 2 // 960
};

export const DEFAULT_PIANOROLL_DATA: PianoRollNodeData = {
  notes: [],
  mode: 'idle',
  lengthBars: 2,
  loop: true,
  syncToTransport: true,
  quantize: '1/16',
  scrollNote: 48,
  zoom: 60
};

export const PIANO_KEY_WIDTH = 44;
export const RULER_HEIGHT = 20;
export const NOTE_HEIGHT = 14;
export const VISIBLE_NOTES = 24;
export const PIANOROLL_MIN_WIDTH = 320;
export const PIANOROLL_DEFAULT_WIDTH = 520;
export const PIANOROLL_DEFAULT_HEIGHT = 240;
export const PIANOROLL_MIN_HEIGHT = 140;

// Zinc-950 palette — matches CurveNode
export const COLORS = {
  bgWhiteRow: '#141417', // slight lift from pure black
  bgBlackRow: '#09090b', // zinc-950 pure
  barLine: '#4b4b54', // more visible bar separators
  beatLine: '#27272a', // zinc-800
  subdivLine: '#1a1a1d',
  ruler: '#18181b', // zinc-900 — subtle lift from grid
  rulerText: '#a1a1aa', // zinc-400 — more readable
  rulerBorder: '#3f3f46', // zinc-700 — visible separator
  noteBase: '#4ade80', // green-400 (curve accent)
  noteHover: '#86efac', // green-300
  noteText: 'rgba(0,0,0,0.85)',
  playhead: 'rgba(255,255,255,0.9)', // bright white playhead
  keyWhite: '#222226', // slightly lighter than pure black
  keyBlack: '#09090b', // zinc-950
  keyBorder: '#18181b', // zinc-900
  keyLabel: '#52525b', // zinc-600
  keyCLabel: '#a1a1aa', // zinc-400 — brighter C labels
  keyActive: '#22c55e' // green-500 — active/preview key
};
