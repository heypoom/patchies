import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tone = vi.hoisted(() => {
  class Context {
    transport = {
      state: 'stopped',
      seconds: 0,
      ticks: 0,
      bpm: { value: 120 },
      timeSignature: [4, 4],
      start() {
        this.state = 'started';
      },
      pause() {
        this.state = 'paused';
      },
      stop() {
        this.state = 'stopped';
      }
    };

    constructor(public rawContext: unknown) {}

    get state() {
      return 'running';
    }
  }

  let context = new Context({ state: 'running' });

  return {
    Context,
    getContext: () => context,
    getTransport: () => context.transport,
    setContext: (next: Context) => {
      context = next;
    },
    start: vi.fn(async () => {})
  };
});

vi.mock('tone', () => tone);

vi.mock('$lib/js-runner/JSRunner', () => ({
  JSRunner: {
    getInstance: () => ({
      preprocessCode: async (code: string) => code,
      executeJavaScript: async () => ({}),
      destroy: () => {}
    })
  }
}));

vi.mock('$lib/utils/createCustomConsole', () => ({
  createCustomConsole: () => ({ log: vi.fn(), error: vi.fn() })
}));

vi.mock('$objects/audio-code/RuntimeAudioCodeState', () => ({
  RuntimeAudioCodeState: class {
    code = '';
    settingsManager = { clearCallbacks: () => {} };
    initialize({ initialData }: { initialData: { code: string } }) {
      this.code = initialData.code;
    }
    getCode() {
      return this.code;
    }
    setCode(code: string) {
      this.code = code;
    }
    publish() {}
  }
}));

const createAudioContext = () =>
  ({
    state: 'running',
    listener: { forwardX: {} },
    createGain: () => ({ gain: { value: 1 }, disconnect: vi.fn() })
  }) as unknown as AudioContext;

describe('tone~ transport lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();

    tone.setContext(new tone.Context({ state: 'running' }));
    tone.start.mockReset();
    tone.start.mockResolvedValue(undefined);

    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['ready', 'pending'])(
    'keeps playing through insertion and reinsertion with a %s upgrade',
    async (upgradeState) => {
      const { Transport } = await import('$lib/transport/Transport');
      const { ToneNode } = await import('./ToneNode');
      const audioContext = createAudioContext();

      await Transport.play();

      Transport.seek(42);
      Transport.setBpm(96);
      Transport.setTimeSignature(7, 8);

      const upgrade = Transport.ensureToneUpgraded(audioContext);

      if (upgradeState === 'ready') {
        await upgrade;
      }

      for (const nodeId of ['first', 'redo', 'second']) {
        const node = new ToneNode(nodeId, audioContext);
        node.bindRuntimeData({ initialData: { code: '// synth' }, update: () => {} });

        await node.create();
        await upgrade;

        expect(Transport.isPlaying).toBe(true);
        expect(tone.getContext().rawContext).toBe(audioContext);
        expect(Transport.seconds).toBeGreaterThanOrEqual(42);
        expect(tone.getTransport().bpm.value).toBe(96);
        expect(tone.getTransport().timeSignature).toEqual([7, 8]);

        await node.send('run', '// updated synth');

        expect(Transport.isPlaying).toBe(true);
        expect(Transport.seconds).toBeGreaterThanOrEqual(42);

        node.destroy();

        expect(Transport.isPlaying).toBe(true);
      }

      Transport.destroy();
    }
  );

  it.each(['paused', 'stopped'] as const)(
    'preserves %s transport during insertion',
    async (state) => {
      const { Transport } = await import('$lib/transport/Transport');
      const { ToneNode } = await import('./ToneNode');

      const audioContext = createAudioContext();

      if (state === 'paused') {
        Transport.pause();
        Transport.seek(24);
      } else {
        Transport.stop();
      }

      const node = new ToneNode('inactive', audioContext);
      node.bindRuntimeData({ initialData: { code: '// synth' }, update: () => {} });

      await node.create();

      expect(Transport.isPlaying).toBe(false);
      expect(Transport.seconds).toBe(state === 'paused' ? 24 : 0);
      expect(Transport.getState().playState).toBe(state);

      node.destroy();
      Transport.destroy();
    }
  );

  it('shares concurrent upgrades and honors pause and seek during audio startup', async () => {
    const { Transport } = await import('$lib/transport/Transport');
    const audioContext = createAudioContext();
    let finishStartup!: () => void;

    const startup = new Promise<void>((resolve) => {
      finishStartup = resolve;
    });

    tone.start.mockReturnValueOnce(startup);

    await Transport.play();
    Transport.seek(42);

    const upgrades = [
      Transport.ensureToneUpgraded(audioContext),
      Transport.ensureToneUpgraded(audioContext)
    ];

    await vi.waitFor(() => expect(tone.start).toHaveBeenCalledTimes(1));

    expect(Transport.isPlaying).toBe(true);
    expect(Transport.seconds).toBeGreaterThanOrEqual(42);

    Transport.pause();
    Transport.seek(64);
    Transport.setBpm(144);
    Transport.setTimeSignature(5, 4);

    finishStartup();
    await Promise.all(upgrades);

    expect(Transport.isToneUpgraded).toBe(true);
    expect(Transport.isPlaying).toBe(false);
    expect(Transport.seconds).toBe(64);
    expect(tone.getTransport().bpm.value).toBe(144);
    expect(tone.getTransport().timeSignature).toEqual([5, 4]);
    expect(tone.start).toHaveBeenCalledTimes(1);

    Transport.destroy();
  });
});
