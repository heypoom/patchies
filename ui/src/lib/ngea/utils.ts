import { NGEA_TUNINGS, type NgeaTuning } from './data';

/** Find a tuning by partial, case-insensitive title match */
export function findTuning(query: string): NgeaTuning | undefined {
  const q = query.toLowerCase();

  return NGEA_TUNINGS.find((t) => t.title.toLowerCase().includes(q));
}

/** Get the within-octave cent offsets (accumulate < 1200) for Strudel scale registration */
export const getNgeaScaleIntervals = (tuning: NgeaTuning): number[] =>
  tuning.data.filter((g) => g.accumulate < 1200).map((g) => g.accumulate / 100);
