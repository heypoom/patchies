export interface TrackData {
  name: string;
  color: string;
  stepOn: boolean[];
  stepValues: number[];
}

// Palette for new tracks. Max 8 tracks (0–7 = single digit handle IDs).
export const TRACK_COLORS = [
  '#e57373',
  '#64b5f6',
  '#ffd54f',
  '#b39ddb',
  '#80cbc4',
  '#a5d6a7',
  '#ffb74d',
  '#ff8a65'
] as const;

export const DEFAULT_TRACKS: TrackData[] = [
  { name: 'KICK', color: '#e57373', stepOn: Array(8).fill(false), stepValues: Array(8).fill(1.0) },
  { name: 'SNARE', color: '#64b5f6', stepOn: Array(8).fill(false), stepValues: Array(8).fill(1.0) },
  { name: 'CHH', color: '#ffd54f', stepOn: Array(8).fill(false), stepValues: Array(8).fill(1.0) },
  { name: 'OHH', color: '#b39ddb', stepOn: Array(8).fill(false), stepValues: Array(8).fill(1.0) }
];
