import type { ParsedMidiFile } from './midi-file-player';

export interface MidiTempoPoint {
  tick: number;
  bpm: number;
}

export function midiTicksToSeconds(ticks: number, file: ParsedMidiFile): number {
  const sortedTempos = [...file.tempos].sort((a, b) => a.tick - b.tick);
  const convertedSeconds = midiTempoTicksToSeconds(ticks, file.ppq, sortedTempos);

  return Math.max(0, Math.min(file.durationSeconds, convertedSeconds));
}

export function midiTempoTicksToSeconds(
  ticks: number,
  ppq: number,
  tempos: MidiTempoPoint[]
): number {
  let seconds = 0;
  let previousTick = 0;
  let currentBpm = 120;

  for (const tempo of tempos) {
    if (tempo.tick > ticks) break;

    seconds += ticksToSeconds(tempo.tick - previousTick, ppq, currentBpm);

    previousTick = tempo.tick;
    currentBpm = tempo.bpm;
  }

  return seconds + ticksToSeconds(ticks - previousTick, ppq, currentBpm);
}

const ticksToSeconds = (ticks: number, ppq: number, bpm: number): number =>
  (ticks / ppq) * (60 / bpm);
