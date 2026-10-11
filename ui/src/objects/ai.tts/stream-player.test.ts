import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechStreamPlayer } from './stream-player';

class FakeSourceBuffer extends EventTarget {
  appendBuffer = vi.fn();
}

class FakeMediaSource extends EventTarget {
  static isTypeSupported = () => true;
  static latest: FakeMediaSource;
  readyState = 'closed';
  buffer = new FakeSourceBuffer();
  addSourceBuffer = vi.fn(() => this.buffer);
  endOfStream = vi.fn();

  constructor() {
    super();
    FakeMediaSource.latest = this;
  }

  open() {
    this.readyState = 'open';
    this.dispatchEvent(new Event('sourceopen'));
  }
}

beforeEach(() => {
  vi.stubGlobal('MediaSource', FakeMediaSource);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stream');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('streamed speech playback', () => {
  it('attaches the media URL before waiting for sourceopen and appends without waiting for EOF', async () => {
    const play = vi.fn();
    const player = new SpeechStreamPlayer(play);
    const source = FakeMediaSource.latest;

    expect(play).toHaveBeenCalledWith('blob:stream');

    const chunk = new Uint8Array([1, 2]);
    const append = player.append(chunk);
    expect(source.buffer.appendBuffer).not.toHaveBeenCalled();

    source.open();
    await vi.waitFor(() => expect(source.buffer.appendBuffer).toHaveBeenCalledWith(chunk));
    expect(source.addSourceBuffer).toHaveBeenCalledWith('audio/mpeg');
    expect(source.endOfStream).not.toHaveBeenCalled();

    source.buffer.dispatchEvent(new Event('updateend'));
    await append;
    await player.finish();

    expect(source.endOfStream).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    player.stop();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stream');
  });

  it('cancels while waiting for sourceopen', async () => {
    const player = new SpeechStreamPlayer(vi.fn());
    const append = player.append(new Uint8Array([1]));
    const assertion = expect(append).rejects.toMatchObject({ name: 'AbortError' });

    player.stop();
    await assertion;
    FakeMediaSource.latest.open();

    expect(FakeMediaSource.latest.addSourceBuffer).not.toHaveBeenCalled();
  });

  it('cancels while a chunk is being appended', async () => {
    const player = new SpeechStreamPlayer(vi.fn());
    const source = FakeMediaSource.latest;
    source.open();
    const append = player.append(new Uint8Array([1]));
    const assertion = expect(append).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(source.buffer.appendBuffer).toHaveBeenCalledOnce());

    player.stop();
    await assertion;
    player.stop();

    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('reports decoder errors', async () => {
    const player = new SpeechStreamPlayer(vi.fn());
    const source = FakeMediaSource.latest;
    source.open();
    const append = player.append(new Uint8Array([1]));
    const assertion = expect(append).rejects.toThrow('Could not decode streamed speech');
    await vi.waitFor(() => expect(source.buffer.appendBuffer).toHaveBeenCalledOnce());

    source.buffer.dispatchEvent(new Event('error'));
    await assertion;
    player.stop();
  });
});
