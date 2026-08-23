import { describe, expect, it, vi } from 'vitest';

import { TONE_JS_PRESETS } from './tone.preset';

describe('poly-synth-midi.tone preset', () => {
  it('releases every overlapping same-pitch note when the sustain pedal is released', () => {
    let receive: (message: Record<string, number | string>) => void = () => {};
    const triggerRelease = vi.fn();
    const synth = {
      connect: () => synth,
      triggerAttack: vi.fn(),
      triggerRelease,
      set: vi.fn()
    };
    const reverb = {
      connect: () => reverb,
      generate: vi.fn()
    };
    function Reverb() {
      return reverb;
    }

    function PolySynth() {
      return synth;
    }

    const Tone = {
      Reverb,
      PolySynth,
      Synth: class {},
      Frequency: (note: number) => ({ toNote: () => `note-${note}` }),
      now: () => 0
    };
    const code = TONE_JS_PRESETS['poly-synth-midi.tone'].data.code;
    const runPreset = new Function('Tone', 'outputNode', 'recv', 'setPortCount', 'setTitle', code);

    runPreset(
      Tone,
      {},
      (handler: typeof receive) => (receive = handler),
      () => {},
      () => {}
    );
    receive({ type: 'noteOn', note: 60, velocity: 100 });
    receive({ type: 'noteOn', note: 60, velocity: 100 });
    receive({ type: 'controlChange', control: 64, value: 1 });
    receive({ type: 'noteOff', note: 60 });
    receive({ type: 'noteOff', note: 60 });
    receive({ type: 'controlChange', control: 64, value: 0 });

    expect(triggerRelease).toHaveBeenCalledTimes(2);
    expect(triggerRelease).toHaveBeenNthCalledWith(1, 'note-60', 0);
    expect(triggerRelease).toHaveBeenNthCalledWith(2, 'note-60', 0);
  });
});
