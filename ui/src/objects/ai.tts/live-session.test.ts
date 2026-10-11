import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPaxaRelayURL, PaxaLiveSession } from './live-session';

class FakeSocket {
  static latest: FakeSocket;
  binaryType = '';
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];
  close = vi.fn();

  constructor(readonly url: string) {
    FakeSocket.latest = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  event(data: unknown) {
    this.onmessage?.({
      data: typeof data === 'string' || data instanceof ArrayBuffer ? data : JSON.stringify(data)
    });
  }
  ready() {
    this.onopen?.();
    this.event({ type: 'relayReady' });
    this.event({ type: 'started', connection: 'session-123' });
  }
}

beforeEach(() => vi.stubGlobal('WebSocket', FakeSocket));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function createSession() {
  const onAudio = vi.fn().mockResolvedValue(undefined);
  const onDone = vi.fn().mockResolvedValue(undefined);
  const onError = vi.fn();
  const session = new PaxaLiveSession({
    url: getPaxaRelayURL('https://patchies.example'),
    apiKey: 'test-key',
    model: 'paxa-tts-flash-v1',
    voice: 'khanomkrok',
    onAudio,
    onDone,
    onError
  });

  return { session, socket: FakeSocket.latest, onAudio, onDone, onError };
}

describe('Paxa live text sessions', () => {
  it('queues fragments and controls until the relay and provider are ready, without putting credentials in the URL', () => {
    const { session, socket } = createSession();
    session.append('สวัสดี ');
    session.append('ครับ');
    session.flush();
    session.end();
    expect(session.acceptsText).toBe(false);
    expect(socket.sent).toEqual([]);
    expect(socket.url).toBe('wss://patchies.example/api/ai/tts/paxa/live');

    socket.onopen?.();
    expect(socket.sent).toEqual([{ type: 'auth', apiKey: 'test-key' }]);

    socket.event({ type: 'relayReady' });
    expect(socket.sent).toHaveLength(2);
    expect(socket.sent[1]).toEqual({
      type: 'start',
      model: 'paxa-tts-flash-v1',
      voice: 'khanomkrok',
      format: 'mp3'
    });

    socket.event({ type: 'started' });
    expect(socket.sent.slice(2)).toEqual([
      { type: 'text', text: 'สวัสดี ' },
      { type: 'text', text: 'ครับ' },
      { type: 'flush' },
      { type: 'end' }
    ]);
    session.stop();
  });

  it('plays audio before done, preserves chunk order, and drains playback before closing', async () => {
    const { session, socket, onAudio, onDone, onError } = createSession();
    socket.ready();
    let release!: () => void;
    onAudio.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    session.append('Hello.');
    socket.event(new Uint8Array([1, 2]).buffer);
    await vi.waitFor(() => expect(onAudio).toHaveBeenCalledWith(new Uint8Array([1, 2])));

    socket.event(new Uint8Array([3]).buffer);
    socket.event({ type: 'done' });
    socket.onclose?.();
    expect(onAudio).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    release();
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(onAudio.mock.calls.map(([chunk]) => [...chunk])).toEqual([[1, 2], [3]]);
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('discards queued audio and late events when stopped', async () => {
    const { session, socket, onAudio, onDone, onError } = createSession();
    socket.ready();
    socket.event(new Uint8Array([1]).buffer);
    session.stop();
    socket.event(new Uint8Array([2]).buffer);
    socket.event({ type: 'done' });
    socket.onclose?.();
    await Promise.resolve();

    expect(onAudio).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it.each(['relay_upstream_unavailable', 'insufficient_credits'])(
    'surfaces %s and closes once',
    (code) => {
      const { session, socket, onError } = createSession();
      socket.event({ type: 'error', code });
      socket.onclose?.();

      expect(onError).toHaveBeenCalledExactlyOnceWith(`Paxa live: ${code}`);
      expect(session.acceptsText).toBe(false);
      expect(socket.close).toHaveBeenCalledOnce();
    }
  );

  it('reports a premature close', () => {
    const { socket, onError } = createSession();
    socket.ready();
    socket.onclose?.();

    expect(onError).toHaveBeenCalledWith('Paxa live connection closed before speech finished.');
  });

  it('bounds connection setup time', () => {
    vi.useFakeTimers();
    const { socket, onError } = createSession();
    vi.advanceTimersByTime(20_000);

    expect(onError).toHaveBeenCalledWith('Paxa live connection timed out.');
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('uses ws on a local HTTP origin', () => {
    expect(getPaxaRelayURL('http://localhost:8090')).toBe(
      'ws://localhost:8090/api/ai/tts/paxa/live'
    );
  });
});
