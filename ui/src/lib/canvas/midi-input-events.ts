import type { MessageEvent, NoteMessageEvent } from 'webmidi';

type ChannelPressureLike = Pick<MessageEvent, 'rawValue' | 'value'> & {
  message: { channel: number };
};

type PolyPressureLike = Pick<NoteMessageEvent, 'rawValue' | 'value'> & {
  message: { channel: number };
  note: { number: number };
};

export const toChannelPressureMessage = (event: ChannelPressureLike) => ({
  type: 'channelPressure' as const,
  pressure: rawMidiValue(event),
  channel: event.message.channel
});

export const toPolyPressureMessage = (event: PolyPressureLike) => ({
  type: 'polyPressure' as const,
  note: event.note.number,
  pressure: rawMidiValue(event),
  channel: event.message.channel
});

function rawMidiValue(event: { rawValue?: number; value?: number | boolean }): number {
  if (typeof event.rawValue === 'number') return event.rawValue;
  if (typeof event.value === 'number') return Math.round(event.value * 127);

  return 0;
}
