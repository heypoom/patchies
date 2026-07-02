import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('audio devices store', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let enumerateDevices: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();

    getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });
    enumerateDevices = vi.fn().mockResolvedValue([
      { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Mic' },
      { deviceId: 'speaker-1', kind: 'audiooutput', label: 'Built-in Speakers' }
    ]);

    vi.stubGlobal('navigator', {
      mediaDevices: {
        addEventListener: vi.fn(),
        enumerateDevices,
        getUserMedia
      }
    });
  });

  it('enumerates output devices without requesting microphone permission', async () => {
    const { audioOutputDevices, enumerateAudioOutputDevices, hasEnumeratedOutputDevices } =
      await import('./audio-devices.store');

    await enumerateAudioOutputDevices();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(enumerateDevices).toHaveBeenCalledOnce();
    expect(get(audioOutputDevices)).toEqual([
      { id: 'speaker-1', kind: 'audiooutput', name: 'Built-in Speakers' }
    ]);
    expect(get(hasEnumeratedOutputDevices)).toBe(true);
  });
});
