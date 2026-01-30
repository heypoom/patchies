import { describe, expect, it } from 'vitest';
import { shouldDimHandle } from './handle-dimming';

describe('shouldDimHandle', () => {
  it('does not dim when not connecting', () => {
    expect(
      shouldDimHandle({
        isConnecting: false,
        connectingFromHandleId: null,
        currentHandleQualifiedId: 'node-1/message-in',
        currentHandlePort: 'inlet',
        isAudioParam: false
      })
    ).toBe(false);
  });

  it('does not dim the source handle itself', () => {
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/message-out',
        currentHandleQualifiedId: 'node-1/message-out',
        currentHandlePort: 'outlet',
        isAudioParam: false
      })
    ).toBe(false);
  });

  it('dims all outlets when connecting from an outlet', () => {
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/message-out',
        currentHandleQualifiedId: 'node-2/message-out',
        currentHandlePort: 'outlet',
        isAudioParam: false
      })
    ).toBe(true);
  });

  it('dims all inlets when connecting from an inlet', () => {
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/message-in',
        currentHandleQualifiedId: 'node-2/message-in',
        currentHandlePort: 'inlet',
        isAudioParam: false
      })
    ).toBe(true);
  });

  it('dims incompatible type connections', () => {
    // Connecting from audio-out should dim message inlets
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/audio-out',
        currentHandleQualifiedId: 'node-2/message-in',
        currentHandlePort: 'inlet',
        isAudioParam: false
      })
    ).toBe(true);
  });

  it('does not dim compatible connections', () => {
    // Connecting from message-out to message-in should not dim
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/message-out',
        currentHandleQualifiedId: 'node-2/message-in',
        currentHandlePort: 'inlet',
        isAudioParam: false
      })
    ).toBe(false);

    // Audio-out to audio-in should not dim
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/audio-out',
        currentHandleQualifiedId: 'node-2/audio-in',
        currentHandlePort: 'inlet',
        isAudioParam: false
      })
    ).toBe(false);
  });

  it('respects AudioParam flexibility', () => {
    // Message-out to AudioParam inlet should NOT dim
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/message-out',
        currentHandleQualifiedId: 'node-2/audio-in-0',
        currentHandlePort: 'inlet',
        isAudioParam: true
      })
    ).toBe(false);

    // Audio-out to AudioParam inlet should NOT dim
    expect(
      shouldDimHandle({
        isConnecting: true,
        connectingFromHandleId: 'node-1/audio-out',
        currentHandleQualifiedId: 'node-2/audio-in-0',
        currentHandlePort: 'inlet',
        isAudioParam: true
      })
    ).toBe(false);
  });
});
