import { describe, expect, it, vi } from 'vitest';

import { MidiFilePlayer, type ParsedMidiFile } from './midi-file-player';

const parsed: ParsedMidiFile = {
  fileName: 'notes.mid',
  ppq: 480,
  durationSeconds: 1,
  durationTicks: 480,
  trackCount: 1,
  events: [
    {
      seconds: 0,
      ticks: 0,
      track: 0,
      message: { type: 'noteOn', note: 60, velocity: 100, channel: 1 }
    },
    {
      seconds: 1,
      ticks: 480,
      track: 0,
      message: { type: 'noteOff', note: 60, velocity: 0, channel: 1 }
    }
  ],
  tempos: [{ tick: 0, seconds: 0, bpm: 120 }],
  timeSignatures: [{ tick: 0, seconds: 0, numerator: 4, denominator: 4 }]
};

describe('MidiFilePlayer', () => {
  it('flushes active notes when stopped before their noteOff event', () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const player = new MidiFilePlayer({ send });

    try {
      player.load(parsed);
      send.mockClear();
      player.play();

      expect(send).toHaveBeenCalledWith({ type: 'noteOn', note: 60, velocity: 100, channel: 1 });

      player.stop();

      expect(send).toHaveBeenCalledWith({ type: 'noteOff', note: 60, velocity: 0, channel: 1 });

      vi.advanceTimersByTime(1000);
      expect(send.mock.calls.filter(([message]) => message.type !== 'position')).toHaveLength(2);
      expect(player.positionSeconds).toBe(0);
      expect(player.playState).toBe('stopped');
    } finally {
      player.destroy();
      vi.useRealTimers();
    }
  });

  it('flushes one noteOff for each overlapping active note voice', () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const player = new MidiFilePlayer({ send });
    const overlapping: ParsedMidiFile = {
      ...parsed,
      durationSeconds: 2,
      durationTicks: 960,
      events: [
        {
          seconds: 0,
          ticks: 0,
          track: 0,
          message: { type: 'noteOn', note: 60, velocity: 100, channel: 1 }
        },
        {
          seconds: 0.5,
          ticks: 240,
          track: 0,
          message: { type: 'noteOn', note: 60, velocity: 90, channel: 1 }
        },
        {
          seconds: 2,
          ticks: 960,
          track: 0,
          message: { type: 'noteOff', note: 60, velocity: 0, channel: 1 }
        }
      ]
    };

    try {
      player.load(overlapping);
      send.mockClear();
      player.play();
      vi.advanceTimersByTime(500);

      player.stop();

      expect(
        send.mock.calls.filter(
          ([message]) => message.type === 'noteOff' && message.note === 60 && message.channel === 1
        )
      ).toHaveLength(2);
    } finally {
      player.destroy();
      vi.useRealTimers();
    }
  });
});
