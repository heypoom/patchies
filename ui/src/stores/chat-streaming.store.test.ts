import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { streamChatMessage, saveChatMessages } = vi.hoisted(() => ({
  streamChatMessage: vi.fn(),
  saveChatMessages: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/ai/chat/resolver', () => ({
  streamChatMessage,
  generateChatTitle: vi.fn()
}));

vi.mock('./chat-history.store', () => ({
  saveChatMessages,
  loadChatMessages: vi.fn().mockResolvedValue([]),
  deleteChatMessages: vi.fn()
}));

vi.mock('$lib/ai/modes/descriptors', () => ({ modeDescriptors: {} }));
vi.mock('$lib/ai/chat/canvas-tools', () => ({ toolNameToMode: vi.fn() }));
vi.mock('./preset-library.store', () => ({ flattenedPresets: {} }));

vi.mock('./extensions.store', () => ({
  BUILT_IN_PACKS: [],
  BUILT_IN_PRESET_PACKS: [],
  enabledPackIds: {},
  enabledPresetPackIds: {},
  togglePack: vi.fn(),
  togglePresetPack: vi.fn(),
  isPackLocked: vi.fn(),
  isPresetPackLocked: vi.fn()
}));

vi.mock('$lib/presets/preset-pack-index', () => ({ getBuiltInPresetPackByPresetName: vi.fn() }));

import { chatStreamStore, type StartStreamParams } from './chat-streaming.store.svelte';

const params: StartStreamParams = {
  chatHistory: [{ role: 'user', content: 'Hi' }],
  nodeContext: null,
  autoApprove: false,
  isFirstMessage: false,
  userContent: 'Hi'
};

const sessionId = 'turn-duration-test';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance'] });
  streamChatMessage.mockReset();
  saveChatMessages.mockClear();
});

afterEach(() => {
  chatStreamStore.removeSession(sessionId);
  vi.useRealTimers();
});

test('persists submission-to-final-token duration including reasoning and tool waits', async () => {
  streamChatMessage.mockImplementationOnce(
    async (_history, _context, onChunk, _signal, onThinking) => {
      vi.advanceTimersByTime(1000);
      onThinking('Read the graph.');

      vi.advanceTimersByTime(2000);
      onChunk('First round.');

      vi.advanceTimersByTime(4000);
      onThinking('After the tool result.');
      onChunk('Final response.');

      vi.advanceTimersByTime(5000);
      onChunk('');

      return 'First round.Final response.';
    }
  );

  await chatStreamStore.startStream(sessionId, params);

  const session = chatStreamStore.getSession(sessionId);

  expect(session.messages[0]).toMatchObject({
    role: 'model',
    content: 'First round.Final response.',
    thinking: 'Read the graph.After the tool result.',
    turnDurationMs: 7000
  });

  expect(saveChatMessages).toHaveBeenCalledWith(sessionId, session.messages);
  expect(session.isLoading).toBe(false);
});

test('starts a fresh timer for each submitted turn', async () => {
  streamChatMessage.mockImplementation(async (_history, _context, onChunk) => {
    vi.advanceTimersByTime(1250);
    onChunk('Hello');

    return 'Hello';
  });

  await chatStreamStore.startStream(sessionId, params);
  vi.advanceTimersByTime(30000);

  await chatStreamStore.startStream(sessionId, params);

  expect(
    chatStreamStore.getSession(sessionId).messages.map((message) => message.turnDurationMs)
  ).toEqual([1250, 1250]);
});

test('uses completion time for successful turns without response text tokens', async () => {
  streamChatMessage.mockImplementationOnce(
    async (_history, _context, _onChunk, _signal, onThinking) => {
      vi.advanceTimersByTime(500);
      onThinking('Reasoning only.');
      vi.advanceTimersByTime(750);

      return '';
    }
  );

  await chatStreamStore.startStream(sessionId, params);

  expect(chatStreamStore.getSession(sessionId).messages[0]).toMatchObject({
    thinking: 'Reasoning only.',
    turnDurationMs: 1250
  });
});
