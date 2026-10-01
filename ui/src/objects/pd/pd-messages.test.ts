import { describe, expect, it, vi } from 'vitest';
import { pdMessageToPatchies, sendPdValue } from './pd-messages';
import type { Pd } from 'libpd-wasm';

function pdMock() {
  return {
    sendBang: vi.fn(),
    sendFloat: vi.fn(),
    sendSymbol: vi.fn(),
    sendList: vi.fn()
  } as unknown as Pd;
}

describe('sendPdValue', () => {
  it('sends Patchies values using Pd-compatible message types', () => {
    const pd = pdMock();

    expect(sendPdValue(pd, 'target', { type: 'bang' })).toBe(true);
    expect(sendPdValue(pd, 'target', 440)).toBe(true);
    expect(sendPdValue(pd, 'target', 'sine')).toBe(true);
    expect(sendPdValue(pd, 'target', [1, 'two'])).toBe(true);
    expect(sendPdValue(pd, 'target', { nope: true })).toBe(false);

    expect(pd.sendBang).toHaveBeenCalledWith('target');
    expect(pd.sendFloat).toHaveBeenCalledWith('target', 440);
    expect(pd.sendSymbol).toHaveBeenCalledWith('target', 'sine');
    expect(pd.sendList).toHaveBeenCalledWith('target', [1, 'two']);
  });
});

describe('pdMessageToPatchies', () => {
  it('converts Pd messages to Patchies values', () => {
    expect(pdMessageToPatchies({ receiver: 'x', selector: 'bang', values: [] })).toEqual({
      type: 'bang'
    });
    expect(pdMessageToPatchies({ receiver: 'x', selector: 'float', values: [2] })).toBe(2);
    expect(pdMessageToPatchies({ receiver: 'x', selector: 'symbol', values: ['ok'] })).toBe('ok');
    expect(pdMessageToPatchies({ receiver: 'x', selector: 'list', values: [1, 'ok'] })).toEqual([
      1,
      'ok'
    ]);
    expect(pdMessageToPatchies({ receiver: 'x', selector: 'note', values: [60, 100] })).toEqual({
      type: 'note',
      values: [60, 100]
    });
  });
});
