import { beforeEach, describe, expect, test, vi } from 'vitest';

const { streamTurn } = vi.hoisted(() => ({ streamTurn: vi.fn() }));

vi.mock('../providers', () => ({
  getTextProvider: () => ({ streamTurn })
}));

vi.mock('./sample-tool-handlers', () => ({
  resolveSearchSamples: vi.fn(),
  resolveSearchFreesound: vi.fn()
}));

import { VirtualFilesystem } from '$lib/vfs';
import { streamChatMessage } from './resolver';

describe('chat VFS tools', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    streamTurn.mockReset();
  });

  test('returns a VFS listing to the model through the chat tool flow', async () => {
    const vfs = VirtualFilesystem.getInstance();

    vfs.registerEntry('user://notes/readme.txt', {
      provider: 'url',
      filename: 'readme.txt',
      mimeType: 'text/plain',
      size: 12
    });

    streamTurn
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'list-files', name: 'list_vfs_files', args: { path: './notes' } }],
        _rawModelTurn: undefined
      })
      .mockResolvedValueOnce({ text: 'Found it.', toolCalls: [], _rawModelTurn: undefined });

    await expect(
      streamChatMessage([{ role: 'user', content: 'List my notes.' }], null, () => {})
    ).resolves.toBe('Found it.');

    expect(streamTurn).toHaveBeenCalledTimes(2);

    expect(streamTurn.mock.calls[1][0]).toContainEqual({
      role: 'user',
      content: '',
      toolResults: [
        {
          callId: 'list-files',
          name: 'list_vfs_files',
          result: {
            path: 'user://notes',
            entries: [{ path: 'user://notes/readme.txt', name: 'readme.txt', kind: 'file' }],
            offset: 0,
            limit: 50,
            truncated: false
          }
        }
      ]
    });
  });
});
