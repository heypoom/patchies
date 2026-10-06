import { describe, expect, test, vi } from 'vitest';
import { getEdgeTypes } from './get-edge-types';

vi.mock('$lib/registry/AudioRegistry', () => ({
  AudioRegistry: {
    getInstance: () => ({
      get: (name: string) => (name === 'gain~' ? { group: 'processors' } : undefined),
      isDefined: (name: string) => name === 'gain~'
    })
  }
}));

const audioNode = {
  id: 'audio',
  type: 'object',
  data: { name: 'gain~' }
};

describe('getEdgeTypes', () => {
  test.each([
    ['audio-out-0', 'audio-in-0', 'audio'],
    ['audio-out-0', 'message-in-0', 'audio'],
    ['message-out', 'audio-in-0', 'audio'],
    ['video-out', 'video-in-0', 'video'],
    ['glsl-out', null, 'video'],
    ['message-out', 'message-in', 'message'],
    [null, null, 'message']
  ] as const)(
    'uses handle styling for missing endpoints: %s → %s',
    (sourceHandle, targetHandle, expected) => {
      expect(getEdgeTypes(undefined, audioNode, sourceHandle, targetHandle)).toBe(expected);
      expect(getEdgeTypes(audioNode, undefined, sourceHandle, targetHandle)).toBe(expected);
      expect(getEdgeTypes(null, null, sourceHandle, targetHandle)).toBe(expected);
    }
  );

  test('styles edges with metadata when both endpoints are present', () => {
    expect(getEdgeTypes(audioNode, audioNode, 'audio-out-0', 'audio-in-0')).toBe('audio');

    const messageNode = {
      id: 'message',
      type: 'object',
      data: { name: 'map' }
    };

    expect(getEdgeTypes(messageNode, messageNode, 'message-out', 'message-in')).toBe('message');
  });
});
