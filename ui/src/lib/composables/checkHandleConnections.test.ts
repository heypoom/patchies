import type { Edge } from '@xyflow/svelte';
import { describe, expect, it } from 'vitest';

import { getAudioInletConnectionKey } from './checkHandleConnections';

describe('checkHandleConnections', () => {
  it('builds a stable signature for audio inlet connections to a node', () => {
    const edges = [
      {
        id: 'edge-a',
        source: 'osc',
        target: 'meter',
        sourceHandle: 'audio-out',
        targetHandle: 'audio-in'
      },
      {
        id: 'edge-b',
        source: 'meter',
        target: 'out',
        sourceHandle: 'message-out',
        targetHandle: 'message-in'
      }
    ] as Edge[];

    expect(getAudioInletConnectionKey(edges, 'meter')).toBe('edge-a:osc:audio-out:audio-in');
  });

  it('changes when the audio inlet source changes', () => {
    const first = [
      {
        id: 'edge-a',
        source: 'osc',
        target: 'meter',
        sourceHandle: 'audio-out',
        targetHandle: 'audio-in'
      }
    ] as Edge[];

    const second = [
      {
        id: 'edge-b',
        source: 'merge',
        target: 'meter',
        sourceHandle: 'audio-out',
        targetHandle: 'audio-in'
      }
    ] as Edge[];

    expect(getAudioInletConnectionKey(first, 'meter')).not.toBe(
      getAudioInletConnectionKey(second, 'meter')
    );
  });
});
