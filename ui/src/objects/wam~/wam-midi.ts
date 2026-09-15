export type WamMidiEvent = {
  type: 'wam-midi';
  time: number;
  data: { bytes: number[] };
};

const clampMidiByte = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(127, Math.round(value)));
};

const clampRawMidiByte = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(255, Math.round(value)));
};

const getChannel = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(15, Math.round(value) - 1));
};

const getTime = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

const readPitchBend = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 8192;

  if (value >= -1 && value <= 1)
    return Math.round(value < 0 ? 8192 + value * 8192 : 8192 + value * 8191);

  return Math.max(0, Math.min(16383, Math.round(value)));
};

export function toWamMidiEvent(message: unknown, fallbackTime: number): WamMidiEvent | null {
  if (typeof message !== 'object' || message === null) return null;

  const data = message as Record<string, unknown>;
  const channel = getChannel(data.channel);
  const time = getTime(data.time, fallbackTime);

  if (data.type === 'noteOn') {
    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0x90 | channel, clampMidiByte(data.note), clampMidiByte(data.velocity)] }
    };
  }

  if (data.type === 'noteOff') {
    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0x80 | channel, clampMidiByte(data.note), clampMidiByte(data.velocity)] }
    };
  }

  if (data.type === 'controlChange') {
    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0xb0 | channel, clampMidiByte(data.control), clampMidiByte(data.value)] }
    };
  }

  if (data.type === 'programChange') {
    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0xc0 | channel, clampMidiByte(data.program)] }
    };
  }

  if (data.type === 'pitchBend') {
    const bend = readPitchBend(data.value);

    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0xe0 | channel, bend & 0x7f, bend >> 7] }
    };
  }

  if (data.type === 'channelPressure') {
    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0xd0 | channel, clampMidiByte(data.pressure)] }
    };
  }

  if (data.type === 'polyPressure') {
    return {
      type: 'wam-midi',
      time,
      data: { bytes: [0xa0 | channel, clampMidiByte(data.note), clampMidiByte(data.pressure)] }
    };
  }

  if (data.type === 'raw' && Array.isArray(data.data)) {
    return { type: 'wam-midi', time, data: { bytes: data.data.map(clampRawMidiByte) } };
  }

  return null;
}
