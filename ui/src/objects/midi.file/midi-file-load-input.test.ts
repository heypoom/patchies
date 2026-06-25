import { describe, expect, it } from 'vitest';

import { parseMidiFileLoadInput } from './midi-file-load-input';

describe('parseMidiFileLoadInput', () => {
  it('routes URL and VFS strings without wrappers', () => {
    expect(parseMidiFileLoadInput('https://example.com/song.mid')).toEqual({
      type: 'url',
      url: 'https://example.com/song.mid'
    });

    expect(parseMidiFileLoadInput('http://example.com/song.mid')).toEqual({
      type: 'url',
      url: 'http://example.com/song.mid'
    });

    expect(parseMidiFileLoadInput('user://Samples/song.mid')).toEqual({
      type: 'vfsPath',
      vfsPath: 'user://Samples/song.mid'
    });

    expect(parseMidiFileLoadInput('obj://midi.file-1/song.mid')).toEqual({
      type: 'vfsPath',
      vfsPath: 'obj://midi.file-1/song.mid'
    });
  });

  it('routes raw byte-like values as inline MIDI data', () => {
    expect(parseMidiFileLoadInput([0x4d, 0x54], 'array.mid')).toEqual({
      type: 'bytes',
      fileName: 'array.mid',
      bytes: new Uint8Array([0x4d, 0x54])
    });

    expect(parseMidiFileLoadInput(new Float32Array([0x4d, 0x54]), 'typed.mid')).toEqual({
      type: 'bytes',
      fileName: 'typed.mid',
      bytes: new Uint8Array([0x4d, 0x54])
    });
  });
});
