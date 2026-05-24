import { describe, expect, it } from 'vitest';
import { isHandshakeBoundOutputWindow } from './IpcSystem';

describe('IpcSystem message gate', () => {
  it('requires a completed outputReady handshake before accepting output input', () => {
    const source = { closed: false } as Window;

    expect(isHandshakeBoundOutputWindow(source, 'https://patchies.test', null, null)).toBe(false);
    expect(isHandshakeBoundOutputWindow(source, 'https://patchies.test', source, null)).toBe(false);

    expect(
      isHandshakeBoundOutputWindow(
        source,
        'https://patchies.test',
        { closed: true } as Window,
        null
      )
    ).toBe(false);
  });

  it('accepts only the handshake-bound output window and origin', () => {
    const source = { closed: false } as Window;
    const otherSource = { closed: false } as Window;

    expect(
      isHandshakeBoundOutputWindow(source, 'https://patchies.test', source, 'https://patchies.test')
    ).toBe(true);

    expect(
      isHandshakeBoundOutputWindow(
        otherSource,
        'https://patchies.test',
        source,
        'https://patchies.test'
      )
    ).toBe(false);

    expect(
      isHandshakeBoundOutputWindow(source, 'https://evil.test', source, 'https://patchies.test')
    ).toBe(false);
  });
});
