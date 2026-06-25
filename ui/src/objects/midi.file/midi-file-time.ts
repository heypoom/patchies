import type { ParsedMidiFile } from './midi-file-player';

export function midiTicksToSeconds(ticks: number, file: ParsedMidiFile): number {
  const sortedTempos = [...file.tempos].sort((a, b) => a.tick - b.tick);
  let seconds = 0;
  let previousTick = 0;
  let currentBpm = 120;

  for (const tempo of sortedTempos) {
    if (tempo.tick > ticks) break;

    seconds += ticksToSeconds(tempo.tick - previousTick, file.ppq, currentBpm);
    previousTick = tempo.tick;
    currentBpm = tempo.bpm;
  }

  const convertedSeconds = seconds + ticksToSeconds(ticks - previousTick, file.ppq, currentBpm);

  return Math.max(0, Math.min(file.durationSeconds, convertedSeconds));
}

function ticksToSeconds(ticks: number, ppq: number, bpm: number): number {
  return (ticks / ppq) * (60 / bpm);
}
