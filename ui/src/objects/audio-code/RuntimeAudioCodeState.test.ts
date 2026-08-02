import { describe, expect, it } from 'vitest';

import { RuntimeAudioCodeState } from './RuntimeAudioCodeState';

describe('RuntimeAudioCodeState', () => {
  it('replays persisted data when initialized with a runtime listener', () => {
    const state = new RuntimeAudioCodeState('runtime-audio-code-state-test');
    const updates: Record<string, unknown>[] = [];

    state.initialize({
      initialData: {
        code: 'setPortCount(1)',
        settings: { gain: 0.5 },
        settingsSchema: [],
        showAudioInput: false,
        messageInletCount: 1,
        messageOutletCount: 2,
        title: 'synth'
      },
      update: (update) => updates.push(update)
    });

    expect(updates).toEqual([
      {
        settings: { gain: 0.5 },
        settingsSchema: [],
        showAudioInput: false,
        messageInletCount: 1,
        messageOutletCount: 2,
        title: 'synth'
      }
    ]);
  });
});
