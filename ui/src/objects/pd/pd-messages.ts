import type { Pd, PdAtom, PdMessage } from 'libpd-wasm';

const isAtom = (value: unknown): value is PdAtom =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

export function sendPdValue(pd: Pd, receiver: string, value: unknown): boolean {
  if (!receiver.trim()) return false;

  if (
    value === null ||
    value === undefined ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      (value as Record<string, unknown>).type === 'bang')
  ) {
    pd.sendBang(receiver);
    return true;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    pd.sendFloat(receiver, value);
    return true;
  }

  if (typeof value === 'string') {
    pd.sendSymbol(receiver, value);
    return true;
  }

  if (Array.isArray(value) && value.every(isAtom)) {
    pd.sendList(receiver, value);
    return true;
  }

  return false;
}

export function pdMessageToPatchies(message: PdMessage): unknown {
  if (message.selector === 'bang') return { type: 'bang' };
  if (message.selector === 'float' || message.selector === 'symbol') return message.values[0];
  if (message.selector === 'list') return message.values;

  return { type: message.selector, values: message.values };
}
