import { parseMidi, type MidiEvent } from 'midi-file';
import { match } from 'ts-pattern';

import type {
  MidiFileOutputMessage,
  ParsedMidiFile,
  ScheduledMidiFileEvent
} from './midi-file-player';
import { midiTempoTicksToSeconds, type MidiTempoPoint } from './midi-file-time';

interface RawEvent {
  ticks: number;
  track: number;
  message: MidiFileOutputMessage;
}

const MAJOR_NOTES = [
  'Cb',
  'Gb',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#'
];

const MINOR_NOTES = [
  'Abm',
  'Ebm',
  'Bbm',
  'Fm',
  'Cm',
  'Gm',
  'Dm',
  'Am',
  'Em',
  'Bm',
  'F#m',
  'C#m',
  'G#m',
  'D#m',
  'A#m'
];

export function parseMidiFile(
  bytes: ArrayBuffer | Uint8Array,
  fileName = 'midi file'
): ParsedMidiFile {
  const data = normalizeMidiChunks(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const parsed = parseMidi(data);

  if (parsed.header.ticksPerBeat === undefined) {
    throw new Error('SMPTE time division is not supported');
  }

  if (parsed.header.format > 2) {
    throw new Error(`Unsupported MIDI file format: ${parsed.header.format}`);
  }

  const ppq = parsed.header.ticksPerBeat;
  const rawEvents: RawEvent[] = [];
  const tempoPoints: MidiTempoPoint[] = [];

  parsed.tracks.forEach((trackEvents, trackIndex) => {
    let ticks = 0;

    for (const event of trackEvents) {
      ticks += event.deltaTime;

      const message = parseEvent(event, ticks, trackIndex, tempoPoints);

      if (message) {
        rawEvents.push({ ticks, track: trackIndex, message });
      }
    }
  });

  if (parsed.tracks.length === 0) {
    throw new Error('Invalid MIDI file: missing MTrk header');
  }

  tempoPoints.sort((a, b) => a.tick - b.tick);

  if (!tempoPoints.some((tempo) => tempo.tick === 0)) {
    tempoPoints.unshift({ tick: 0, bpm: 120 });
  }

  rawEvents.sort((a, b) => a.ticks - b.ticks || a.track - b.track);

  const events: ScheduledMidiFileEvent[] = rawEvents.map((event) => ({
    ...event,
    seconds: tickToSeconds(event.ticks, ppq, tempoPoints)
  }));

  const durationTicks = rawEvents.reduce((max, event) => Math.max(max, event.ticks), 0);
  const durationSeconds = tickToSeconds(durationTicks, ppq, tempoPoints);

  const tempos = tempoPoints.map((tempo) => ({
    ...tempo,
    seconds: tickToSeconds(tempo.tick, ppq, tempoPoints)
  }));

  const timeSignatures = events
    .filter(
      (
        event
      ): event is ScheduledMidiFileEvent & {
        message: { type: 'timeSignature'; numerator: number; denominator: number; tick: number };
      } => event.message.type === 'timeSignature'
    )
    .map((event) => ({
      tick: event.ticks,
      seconds: event.seconds,
      numerator: event.message.numerator,
      denominator: event.message.denominator
    }));

  return {
    fileName,
    ppq,
    durationSeconds,
    durationTicks,
    trackCount: parsed.tracks.length,
    events,
    tempos,
    timeSignatures
  };
}

const parseEvent = (
  event: MidiEvent,
  tick: number,
  track: number,
  tempoPoints: MidiTempoPoint[]
): MidiFileOutputMessage | null =>
  match<MidiEvent, MidiFileOutputMessage | null>(event)
    .with({ type: 'trackName' }, (event) => ({ type: 'trackName', name: event.text, track }))
    .with({ type: 'setTempo' }, (event) => {
      const bpm = 60_000_000 / event.microsecondsPerBeat;
      tempoPoints.push({ tick, bpm });
      return { type: 'tempo', bpm, tick };
    })
    .with({ type: 'timeSignature' }, (event) => ({
      type: 'timeSignature',
      numerator: event.numerator,
      denominator: event.denominator,
      tick
    }))
    .with({ type: 'keySignature' }, (event) => ({
      type: 'keySignature',
      key: keySignatureName(event.key, event.scale),
      tick
    }))
    .with({ type: 'noteOn' }, (event) => ({
      type: 'noteOn',
      note: event.noteNumber,
      velocity: event.velocity,
      channel: midiChannel(event)
    }))
    .with({ type: 'noteOff' }, (event) => ({
      type: 'noteOff',
      note: event.noteNumber,
      velocity: event.velocity,
      channel: midiChannel(event)
    }))
    .with({ type: 'controller' }, (event) => ({
      type: 'controlChange',
      control: event.controllerType,
      value: event.value,
      channel: midiChannel(event)
    }))
    .with({ type: 'programChange' }, (event) => ({
      type: 'programChange',
      program: event.programNumber,
      channel: midiChannel(event)
    }))
    .with({ type: 'pitchBend' }, (event) => ({
      type: 'pitchBend',
      value: event.value / 8192,
      channel: midiChannel(event)
    }))
    .with({ type: 'channelAftertouch' }, (event) => ({
      type: 'channelPressure',
      pressure: event.amount,
      channel: midiChannel(event)
    }))
    .with({ type: 'noteAftertouch' }, (event) => ({
      type: 'polyPressure',
      note: event.noteNumber,
      pressure: event.amount,
      channel: midiChannel(event)
    }))
    .otherwise(() => null);

const midiChannel = (event: MidiEvent & { channel: number }): number => event.channel + 1;

function normalizeMidiChunks(bytes: Uint8Array): Uint8Array {
  const header = readChunk(bytes, 0);
  if (!header || header.id !== 'MThd') {
    throw new Error('Invalid MIDI file: missing MThd header');
  }

  if (header.data.length < 6) {
    throw new Error('Invalid MIDI file: malformed MThd header');
  }

  const chunks: Array<{ id: string; data: Uint8Array }> = [{ id: header.id, data: header.data }];

  let position = header.nextPosition;
  let trackCount = 0;

  while (position + 8 <= bytes.length) {
    const chunk = readChunk(bytes, position);
    if (!chunk) break;

    if (chunk.id === 'MTrk') {
      chunks.push({ id: chunk.id, data: chunk.data });
      trackCount += 1;
    }

    position = chunk.nextPosition;
  }

  if (trackCount === 0) {
    throw new Error('Invalid MIDI file: missing MTrk header');
  }

  const normalizedHeader = header.data.slice();
  normalizedHeader[2] = (trackCount >> 8) & 0xff;
  normalizedHeader[3] = trackCount & 0xff;

  chunks[0] = { id: header.id, data: normalizedHeader };

  return writeChunks(chunks);
}

function readChunk(
  bytes: Uint8Array,
  position: number
): { id: string; data: Uint8Array; nextPosition: number } | null {
  if (position + 8 > bytes.length) return null;

  const id = new TextDecoder().decode(bytes.slice(position, position + 4));
  const length = readUint32(bytes, position + 4);

  const dataStart = position + 8;
  const dataEnd = dataStart + length;

  if (dataEnd > bytes.length) {
    throw new Error('Unexpected end of MIDI file');
  }

  return { id, data: bytes.slice(dataStart, dataEnd), nextPosition: dataEnd };
}

function writeChunks(chunks: Array<{ id: string; data: Uint8Array }>): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const bytes = new Uint8Array(length);

  let position = 0;

  for (const chunk of chunks) {
    for (let i = 0; i < 4; i++) {
      bytes[position + i] = chunk.id.charCodeAt(i);
    }

    writeUint32(bytes, position + 4, chunk.data.length);

    bytes.set(chunk.data, position + 8);
    position += 8 + chunk.data.length;
  }

  return bytes;
}

const readUint32 = (bytes: Uint8Array, position: number): number =>
  ((bytes[position] << 24) |
    (bytes[position + 1] << 16) |
    (bytes[position + 2] << 8) |
    bytes[position + 3]) >>>
  0;

function writeUint32(bytes: Uint8Array, position: number, value: number): void {
  bytes[position] = (value >> 24) & 0xff;
  bytes[position + 1] = (value >> 16) & 0xff;
  bytes[position + 2] = (value >> 8) & 0xff;
  bytes[position + 3] = value & 0xff;
}

const tickToSeconds = (tick: number, ppq: number, tempos: MidiTempoPoint[]): number =>
  midiTempoTicksToSeconds(tick, ppq, tempos);

const keySignatureName = (sf: number, mi: number): string =>
  (mi === 1 ? MINOR_NOTES : MAJOR_NOTES)[sf + 7] ?? 'C';
