import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveSpeech } from './useLiveSpeech.svelte';
import type { PaxaLiveSession } from './live-session';

type Options = ConstructorParameters<typeof PaxaLiveSession>[0];

const mocks = vi.hoisted(() => ({
  sessions: [] as Array<{
    options: Options;
    acceptsText: boolean;
    append: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
  appendAudio: vi.fn().mockResolvedValue(undefined),
  finishAudio: vi.fn().mockResolvedValue(undefined),
  stopPlayer: vi.fn()
}));

vi.mock('./live-session', () => ({
  getPaxaRelayURL: () => 'ws://localhost/api/ai/tts/paxa/live',

  PaxaLiveSession: class {
    acceptsText = true;
    append = vi.fn();
    flush = vi.fn();

    end = () => {
      this.acceptsText = false;
    };

    stop = vi.fn(() => {
      this.acceptsText = false;
    });

    constructor(readonly options: Options) {
      mocks.sessions.push(this);
    }
  }
}));

vi.mock('./stream-player', () => ({
  SpeechStreamPlayer: class {
    static isSupported = () => true;
    append = mocks.appendAudio;
    finish = mocks.finishAudio;
    stop = mocks.stopPlayer;
  }
}));

beforeEach(() => {
  mocks.sessions.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal('location', { origin: 'http://localhost' });
});

afterEach(() => vi.unstubAllGlobals());

function createLiveSpeech(provider: 'gemini' | 'paxa' = 'paxa') {
  const showError = vi.fn();
  const stopAudio = vi.fn();

  const live = useLiveSpeech({
    getOptions: () => ({ provider, model: 'model', voiceName: 'voice', text: '', style: '' }),
    getApiKey: () => 'test-key',
    beforeStart: () => live.stop(),
    playAudio: vi.fn(),
    stopAudio,
    showError
  });

  return { live, showError, stopAudio };
}

describe('live speech lifecycle', () => {
  it('keeps fragments in one session and stops active audio on cancellation', async () => {
    const { live, stopAudio } = createLiveSpeech();
    live.append('Hello ');
    live.append('world');

    expect(mocks.sessions).toHaveLength(1);
    const session = mocks.sessions[0];

    expect(session.append.mock.calls).toEqual([['Hello '], ['world']]);
    expect(live.isLoading).toBe(true);

    await session.options.onAudio(new Uint8Array([1]));
    live.stop();

    expect(session.stop).toHaveBeenCalledOnce();
    expect(mocks.stopPlayer).toHaveBeenCalledOnce();
    expect(stopAudio).toHaveBeenCalledOnce();
    expect(live.isLoading).toBe(false);

    await session.options.onAudio(new Uint8Array([2]));
    expect(mocks.appendAudio).toHaveBeenCalledOnce();
  });

  it('starts a fresh session after end and ignores old completion/errors', async () => {
    const { live, showError } = createLiveSpeech();
    live.append('First');

    const old = mocks.sessions[0];
    live.end();
    live.append('Second');

    expect(mocks.sessions).toHaveLength(2);
    expect(old.stop).toHaveBeenCalledOnce();

    await old.options.onDone();
    old.options.onError('stale failure');

    expect(live.isLoading).toBe(true);
    expect(showError).not.toHaveBeenCalled();

    await mocks.sessions[1].options.onDone();
    expect(live.isLoading).toBe(false);
    live.stop();
  });

  it('rejects incremental input on Gemini without opening a connection', () => {
    const { live, showError } = createLiveSpeech('gemini');
    live.append('Hello');

    expect(mocks.sessions).toHaveLength(0);
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('requires the Paxa provider'));
    expect(live.isLoading).toBe(false);
  });
});
