import { describe, expect, it } from 'vitest';

import { RuntimeAudioCodeState } from './RuntimeAudioCodeState';

describe('RuntimeAudioCodeState', () => {
  it('replays code-derived editor metadata when the runtime listener attaches', () => {
    const state = new RuntimeAudioCodeState('runtime-audio-code-state-test');
    const updates: Record<string, unknown>[] = [];

    state.initialize({
      code: 'setPortCount(1)',
      settings: { gain: 0.5 },
      settingsSchema: [],
      showAudioInput: false
    });
    state.publish({ messageInletCount: 1, messageOutletCount: 2, title: 'synth' });
    state.setListener((update) => updates.push(update));

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
