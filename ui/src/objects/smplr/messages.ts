export type SmplrDefaultDescriptor = {
  defaultBangNote: number | string;
  defaultVelocity?: number;
};

export type SmplrStartCommand = {
  type: 'start';
  event: {
    note: number | string;
    velocity?: number;
    time?: number;
    duration?: number;
  };
};

export type SmplrStopCommand = {
  type: 'stop';
  target: {
    stopId?: number | string;
    time?: number;
  };
};

export type SmplrCommand =
  | SmplrStartCommand
  | SmplrStopCommand
  | { type: 'stopAll'; time?: number }
  | { type: 'cc'; control: number; value: number }
  | { type: 'program'; program: number }
  | { type: 'volume'; value: number }
  | { type: 'detune'; value: number }
  | { type: 'reverse'; value: boolean }
  | { type: 'ignored'; reason: string };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clampMidi = (value: number): number => Math.max(0, Math.min(127, Math.round(value)));

const optionalFiniteNumber = (value: unknown): number | undefined =>
  isFiniteNumber(value) ? value : undefined;

export function parseDefaultNote(value: number | string): number | string {
  if (typeof value === 'number') return value;

  const trimmed = value.trim();
  if (trimmed === '') return value;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : value;
}

export function normalizeVelocity(value: unknown, fallback = 100): number {
  if (!isFiniteNumber(value)) return clampMidi(fallback);

  if (value >= 0 && value <= 1) {
    return clampMidi(value * 127);
  }

  return clampMidi(value);
}

function normalizeTriggerVelocity(value: unknown, fallback = 100): number {
  if (!isFiniteNumber(value)) return clampMidi(fallback);

  return clampMidi(value * 127);
}

export function normalizeSmplrMessage(
  message: unknown,
  descriptor: SmplrDefaultDescriptor
): SmplrCommand {
  const defaultNote = parseDefaultNote(descriptor.defaultBangNote);
  const defaultVelocity = descriptor.defaultVelocity ?? 100;

  if (isFiniteNumber(message)) {
    if (message < 0) return { type: 'ignored', reason: 'negative-number' };

    return {
      type: 'start',
      event: {
        note: defaultNote,
        velocity: normalizeTriggerVelocity(message, defaultVelocity)
      }
    };
  }

  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return { type: 'ignored', reason: 'unsupported-message' };
  }

  const msg = message as Record<string, unknown>;

  if (msg.type === 'bang') {
    return {
      type: 'start',
      event: compactStartEvent({
        note: defaultNote,
        velocity: normalizeTriggerVelocity(msg.value, defaultVelocity),
        time: optionalFiniteNumber(msg.time),
        duration: optionalFiniteNumber(msg.duration)
      })
    };
  }

  if (msg.type === 'noteOn') {
    const note = getNote(msg.note);
    if (note === undefined) return { type: 'ignored', reason: 'missing-note' };

    const velocity = normalizeVelocity(msg.velocity, defaultVelocity);
    if (velocity === 0) {
      return {
        type: 'stop',
        target: compactStopTarget({ stopId: note, time: optionalFiniteNumber(msg.time) })
      };
    }

    return {
      type: 'start',
      event: compactStartEvent({
        note,
        velocity,
        time: optionalFiniteNumber(msg.time),
        duration: optionalFiniteNumber(msg.duration)
      })
    };
  }

  if (msg.type === 'noteOff') {
    const note = getNote(msg.note);
    if (note === undefined) return { type: 'ignored', reason: 'missing-note' };

    return {
      type: 'stop',
      target: compactStopTarget({ stopId: note, time: optionalFiniteNumber(msg.time) })
    };
  }

  if (msg.type === 'controlChange' && isFiniteNumber(msg.control) && isFiniteNumber(msg.value)) {
    return { type: 'cc', control: clampMidi(msg.control), value: clampMidi(msg.value) };
  }

  if (msg.type === 'programChange' && isFiniteNumber(msg.program)) {
    return { type: 'program', program: Math.max(0, Math.round(msg.program)) };
  }

  if (msg.type === 'setGain' && isFiniteNumber(msg.value)) {
    return { type: 'volume', value: clampMidi(msg.value) };
  }

  if (msg.type === 'setDetune' && isFiniteNumber(msg.value)) {
    return { type: 'detune', value: msg.value };
  }

  if (msg.type === 'setReverse' && typeof msg.value === 'boolean') {
    return { type: 'reverse', value: msg.value };
  }

  if (msg.type === 'stop') {
    const time = optionalFiniteNumber(msg.time);
    return time === undefined ? { type: 'stopAll' } : { type: 'stopAll', time };
  }

  return { type: 'ignored', reason: 'unsupported-message' };
}

function getNote(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') return value;
  return undefined;
}

function compactStartEvent(event: SmplrStartCommand['event']): SmplrStartCommand['event'] {
  return Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  ) as SmplrStartCommand['event'];
}

function compactStopTarget(target: SmplrStopCommand['target']): SmplrStopCommand['target'] {
  return Object.fromEntries(
    Object.entries(target).filter(([, value]) => value !== undefined)
  ) as SmplrStopCommand['target'];
}
