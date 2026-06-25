import { describe, expect, it } from 'vitest';

import { parseMidiFile } from './midi-file-parser';

function vlq(value: number): number[] {
  const bytes = [value & 0x7f];
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  return bytes;
}

function textEncoderBytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}

function track(events: number[][]): number[] {
  const body = events.flat();
  const length = body.length;
  return [
    0x4d,
    0x54,
    0x72,
    0x6b,
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...body
  ];
}

function chunk(type: string, body: number[]): number[] {
  const typeBytes = textEncoderBytes(type);
  const length = body.length;
  return [
    ...typeBytes,
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...body
  ];
}

function midiFile(trackBodies: number[] | number[][]): Uint8Array {
  const tracks = Array.isArray(trackBodies[0])
    ? (trackBodies as number[][])
    : [trackBodies as number[]];
  return new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64,
    0x00,
    0x00,
    0x00,
    0x06,
    0x00,
    0x00,
    0x00,
    tracks.length,
    0x01,
    0xe0,
    ...tracks.flat()
  ]);
}

describe('parseMidiFile', () => {
  it('rejects malformed header chunks shorter than the MIDI header body', () => {
    const bytes = new Uint8Array(chunk('MThd', [0x00, 0x00, 0x00, 0x01]));

    expect(() => parseMidiFile(bytes, 'malformed.mid')).toThrow(
      'Invalid MIDI file: malformed MThd header'
    );
  });

  it('normalizes channel and meta events from a standard MIDI file', () => {
    const bytes = midiFile(
      track([
        [0x00, 0xff, 0x03, 0x04, ...textEncoderBytes('Lead')],
        [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20],
        [0x00, 0xff, 0x58, 0x04, 0x03, 0x03, 0x18, 0x08],
        [0x00, 0xc0, 0x05],
        [0x00, 0x90, 0x3c, 0x64],
        [...vlq(480), 0x80, 0x3c, 0x00],
        [0x00, 0xb0, 0x40, 0x7f],
        [0x00, 0xe0, 0x00, 0x60],
        [0x00, 0xd0, 0x45],
        [0x00, 0xa0, 0x3c, 0x20],
        [0x00, 0xff, 0x2f, 0x00]
      ])
    );

    const parsed = parseMidiFile(bytes, 'fixture.mid');

    expect(parsed.fileName).toBe('fixture.mid');
    expect(parsed.ppq).toBe(480);
    expect(parsed.trackCount).toBe(1);
    expect(parsed.durationTicks).toBe(480);
    expect(parsed.tempos).toEqual([{ tick: 0, seconds: 0, bpm: 120 }]);
    expect(parsed.timeSignatures).toEqual([{ tick: 0, seconds: 0, numerator: 3, denominator: 8 }]);

    expect(parsed.events.map((event) => event.message)).toEqual([
      { type: 'trackName', name: 'Lead', track: 0 },
      { type: 'tempo', bpm: 120, tick: 0 },
      { type: 'timeSignature', numerator: 3, denominator: 8, tick: 0 },
      { type: 'programChange', program: 5, channel: 1 },
      { type: 'noteOn', note: 60, velocity: 100, channel: 1 },
      { type: 'noteOff', note: 60, velocity: 0, channel: 1 },
      { type: 'controlChange', control: 64, value: 127, channel: 1 },
      { type: 'pitchBend', value: 0.5, channel: 1 },
      { type: 'channelPressure', pressure: 69, channel: 1 },
      { type: 'polyPressure', note: 60, pressure: 32, channel: 1 }
    ]);
  });

  it('skips unknown chunks while finding declared tracks', () => {
    const bytes = midiFile([
      track([
        [0x00, 0x90, 0x3c, 0x64],
        [0x00, 0xff, 0x2f, 0x00]
      ]),
      chunk('JUNK', [0x00, 0x01, 0x02, 0x03]),
      track([
        [0x00, 0x90, 0x40, 0x64],
        [0x00, 0xff, 0x2f, 0x00]
      ])
    ]);

    const parsed = parseMidiFile(bytes, 'extra-chunk.mid');

    expect(parsed.trackCount).toBe(2);
    expect(parsed.events.map((event) => event.message)).toEqual([
      { type: 'noteOn', note: 60, velocity: 100, channel: 1 },
      { type: 'noteOn', note: 64, velocity: 100, channel: 1 }
    ]);
  });
});
