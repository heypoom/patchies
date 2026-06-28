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
      expect(send).toHaveBeenCalledTimes(2);
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

  it('emits position messages only when enabled', () => {
    const send = vi.fn();
    const quietPlayer = new MidiFilePlayer({ send });

    quietPlayer.load(parsed);
    quietPlayer.seek(0.5);

    expect(send.mock.calls.some(([message]) => message.type === 'position')).toBe(false);
    quietPlayer.destroy();

    send.mockClear();
    const reportingPlayer = new MidiFilePlayer({
      send,
      sendPositionEvents: () => true
    });

    reportingPlayer.load(parsed);
    reportingPlayer.seek(0.5);

    expect(send).toHaveBeenCalledWith({ type: 'position', seconds: 0.5, progress: 0.5 });
    reportingPlayer.destroy();
  });

  it('includes initial and preload program state in loaded metadata', () => {
    const send = vi.fn();
    const player = new MidiFilePlayer({ send });
    const programFile: ParsedMidiFile = {
      ...parsed,
      events: [
        {
          seconds: 0,
          ticks: 0,
          track: 0,
          message: { type: 'programChange', program: 40, channel: 2 }
        },
        {
          seconds: 0.5,
          ticks: 240,
          track: 0,
          message: { type: 'programChange', program: 12, channel: 2 }
        },
        {
          seconds: 0.75,
          ticks: 360,
          track: 0,
          message: { type: 'programChange', program: 12, channel: 2 }
        },
        {
          seconds: 0,
          ticks: 0,
          track: 0,
          message: { type: 'programChange', program: 60, channel: 4 }
        }
      ]
    };

    player.load(programFile);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'loaded',
        programs: [
          { channel: 2, program: 40 },
          { channel: 4, program: 60 }
        ],
        preloadPrograms: [
          { channel: 2, program: 12 },
          { channel: 2, program: 40 },
          { channel: 4, program: 60 }
        ]
      })
    );
    player.destroy();
  });

  it('restarts from the beginning when played again after reaching the end', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const send = vi.fn();
    const player = new MidiFilePlayer({ send });

    try {
      player.load(parsed);
      send.mockClear();

      player.play();
      vi.advanceTimersByTime(1000);

      expect(player.playState).toBe('stopped');
      expect(player.positionSeconds).toBe(1);

      send.mockClear();
      vi.setSystemTime(1000);
      player.play();

      expect(player.playState).toBe('playing');
      expect(player.positionSeconds).toBe(0);
      expect(send).toHaveBeenCalledWith({ type: 'noteOn', note: 60, velocity: 100, channel: 1 });
    } finally {
      player.destroy();
      vi.useRealTimers();
    }
  });
});
