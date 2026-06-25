import type {
  MidiFileOutputMessage,
  ParsedMidiFile,
  ScheduledMidiFileEvent
} from './midi-file-player';

interface RawEvent {
  ticks: number;
  track: number;
  message: MidiFileOutputMessage;
}

interface TempoPoint {
  tick: number;
  bpm: number;
}

export function parseMidiFile(
  bytes: ArrayBuffer | Uint8Array,
  fileName = 'midi file'
): ParsedMidiFile {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const reader = new MidiReader(data);

  if (reader.readAscii(4) !== 'MThd') {
    throw new Error('Invalid MIDI file: missing MThd header');
  }

  const headerLength = reader.readUint32();
  const format = reader.readUint16();
  const declaredTrackCount = reader.readUint16();
  const division = reader.readUint16();

  if ((division & 0x8000) !== 0) {
    throw new Error('SMPTE time division is not supported');
  }

  if (format > 2) {
    throw new Error(`Unsupported MIDI file format: ${format}`);
  }

  const ppq = division;
  reader.skip(headerLength - 6);

  const rawEvents: RawEvent[] = [];
  const tempoPoints: TempoPoint[] = [];
  let parsedTrackCount = 0;

  while (reader.remaining >= 8 && parsedTrackCount < declaredTrackCount) {
    const chunkType = reader.readAscii(4);
    const chunkLength = reader.readUint32();

    if (chunkType === 'MTrk') {
      parseTrack(reader, parsedTrackCount, chunkLength, rawEvents, tempoPoints);
      parsedTrackCount += 1;
    } else {
      reader.skip(chunkLength);
    }
  }

  if (parsedTrackCount === 0) {
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
    trackCount: parsedTrackCount,
    events,
    tempos,
    timeSignatures
  };
}

function parseTrack(
  reader: MidiReader,
  track: number,
  length: number,
  events: RawEvent[],
  tempoPoints: TempoPoint[]
): void {
  const end = reader.position + length;
  let ticks = 0;
  let runningStatus: number | null = null;

  while (reader.position < end) {
    ticks += reader.readVlq();
    let status = reader.readUint8();

    if (status < 0x80) {
      if (runningStatus === null) {
        throw new Error('Invalid MIDI file: running status without previous status');
      }
      reader.unread();
      status = runningStatus;
    } else if (status < 0xf0) {
      runningStatus = status;
    }

    if (status === 0xff) {
      const metaType = reader.readUint8();
      const length = reader.readVlq();
      const payload = reader.readBytes(length);
      const message = parseMetaEvent(metaType, payload, ticks, track, tempoPoints);
      if (message) events.push({ ticks, track, message });
      if (metaType === 0x2f) break;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      reader.skip(reader.readVlq());
      continue;
    }

    const message = parseChannelEvent(status, reader);
    if (message) events.push({ ticks, track, message });
  }

  reader.position = end;
}

function parseMetaEvent(
  type: number,
  payload: Uint8Array,
  tick: number,
  track: number,
  tempoPoints: TempoPoint[]
): MidiFileOutputMessage | null {
  if (type === 0x03) {
    return { type: 'trackName', name: new TextDecoder().decode(payload), track };
  }

  if (type === 0x51 && payload.length >= 3) {
    const microsPerQuarter = (payload[0] << 16) | (payload[1] << 8) | payload[2];
    const bpm = 60_000_000 / microsPerQuarter;
    tempoPoints.push({ tick, bpm });
    return { type: 'tempo', bpm, tick };
  }

  if (type === 0x58 && payload.length >= 2) {
    return {
      type: 'timeSignature',
      numerator: payload[0],
      denominator: 2 ** payload[1],
      tick
    };
  }

  if (type === 0x59 && payload.length >= 2) {
    return { type: 'keySignature', key: keySignatureName(payload[0], payload[1]), tick };
  }

  return null;
}

function parseChannelEvent(status: number, reader: MidiReader): MidiFileOutputMessage | null {
  const eventType = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  if (eventType === 0x80) {
    return { type: 'noteOff', note: reader.readUint8(), velocity: reader.readUint8(), channel };
  }

  if (eventType === 0x90) {
    const note = reader.readUint8();
    const velocity = reader.readUint8();
    return velocity === 0
      ? { type: 'noteOff', note, velocity: 0, channel }
      : { type: 'noteOn', note, velocity, channel };
  }

  if (eventType === 0xa0) {
    return {
      type: 'polyPressure',
      note: reader.readUint8(),
      pressure: reader.readUint8(),
      channel
    };
  }

  if (eventType === 0xb0) {
    return {
      type: 'controlChange',
      control: reader.readUint8(),
      value: reader.readUint8(),
      channel
    };
  }

  if (eventType === 0xc0) {
    return { type: 'programChange', program: reader.readUint8(), channel };
  }

  if (eventType === 0xd0) {
    return { type: 'channelPressure', pressure: reader.readUint8(), channel };
  }

  if (eventType === 0xe0) {
    const lsb = reader.readUint8();
    const msb = reader.readUint8();
    const raw = (msb << 7) | lsb;
    return { type: 'pitchBend', value: (raw - 8192) / 8192, channel };
  }

  return null;
}

function tickToSeconds(tick: number, ppq: number, tempos: TempoPoint[]): number {
  let seconds = 0;
  let previousTick = 0;
  let currentBpm = 120;

  for (const tempo of tempos) {
    if (tempo.tick > tick) break;
    seconds += ticksToSeconds(tempo.tick - previousTick, ppq, currentBpm);
    previousTick = tempo.tick;
    currentBpm = tempo.bpm;
  }

  return seconds + ticksToSeconds(tick - previousTick, ppq, currentBpm);
}

function ticksToSeconds(ticks: number, ppq: number, bpm: number): number {
  return (ticks / ppq) * (60 / bpm);
}

function keySignatureName(sfByte: number, mi: number): string {
  const sf = sfByte > 127 ? sfByte - 256 : sfByte;
  const major = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const minor = [
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
  return (mi === 1 ? minor : major)[sf + 7] ?? 'C';
}

class MidiReader {
  position = 0;

  constructor(private bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.position;
  }

  readAscii(length: number): string {
    return new TextDecoder().decode(this.readBytes(length));
  }

  readUint8(): number {
    if (this.position >= this.bytes.length) throw new Error('Unexpected end of MIDI file');
    return this.bytes[this.position++];
  }

  readUint16(): number {
    return (this.readUint8() << 8) | this.readUint8();
  }

  readUint32(): number {
    return (
      ((this.readUint8() << 24) |
        (this.readUint8() << 16) |
        (this.readUint8() << 8) |
        this.readUint8()) >>>
      0
    );
  }

  readVlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const byte = this.readUint8();
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error('Invalid MIDI file: VLQ is too long');
  }

  readBytes(length: number): Uint8Array {
    if (this.position + length > this.bytes.length) throw new Error('Unexpected end of MIDI file');
    const value = this.bytes.slice(this.position, this.position + length);
    this.position += length;
    return value;
  }

  skip(length: number): void {
    this.position += length;
    if (this.position > this.bytes.length) throw new Error('Unexpected end of MIDI file');
  }

  unread(): void {
    this.position -= 1;
  }
}
