import { expect, test, vi } from 'vitest';
import type { AiPromptCallbacks } from './ai-prompt-controller.svelte';
import type { ThinkingCallback } from './providers/types';

const { runModeResolver } = vi.hoisted(() => ({ runModeResolver: vi.fn() }));

vi.mock('./modes/run-resolver', () => ({ runModeResolver }));
vi.mock('./modes/descriptors', () => ({ getModeDescriptor: () => ({ promptOptional: false }) }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { createAiPromptController } from './ai-prompt-controller.svelte';

const callbacks: AiPromptCallbacks = {
  onInsertObject: vi.fn(),
  onInsertMultipleObjects: vi.fn(),
  onEditObject: vi.fn(),
  onReplaceObject: vi.fn(),
  onConnectEdges: vi.fn(),
  onDisconnectEdges: vi.fn(),
  onDeleteObjects: vi.fn(),
  onMoveObjects: vi.fn()
};

test('AI Edit keeps reasoning fragments in a single block per generation', async () => {
  const controller = createAiPromptController(callbacks);
  controller.promptText = 'Route and generate';
  runModeResolver.mockImplementationOnce(
    async (_mode, _prompt, _context, _signal, onThinking: ThinkingCallback) => {
      onThinking('', { newGeneration: true });
      onThinking('The');
      onThinking(' user');
      onThinking(' wants routing.');

      expect(controller.thinkingLog).toEqual(['The user wants routing.']);
      expect(controller.thinkingText).toBe('The user wants routing.');

      onThinking('', { newGeneration: true });
      onThinking('Generate');
      onThinking(' configuration.');

      expect(controller.thinkingLog).toEqual([
        'The user wants routing.',
        'Generate configuration.'
      ]);
      expect(controller.thinkingText).toBe('Generate configuration.');

      return { kind: 'single', type: 'js', data: {} };
    }
  );

  await expect(controller.submit()).resolves.toBe(true);
});

test('AI Edit does not apply results from a failed generation', async () => {
  const onEditObject = vi.fn();
  const controller = createAiPromptController({ ...callbacks, onEditObject });
  controller.setMode('edit', {});
  controller.promptText = 'Edit';
  runModeResolver.mockRejectedValueOnce(
    new Error('OpenRouter stream error: Provider disconnected')
  );

  await expect(controller.submit()).resolves.toBe(false);

  expect(controller.errorMessage).toBe('OpenRouter stream error: Provider disconnected');
  expect(onEditObject).not.toHaveBeenCalled();
  expect(controller.isLoading).toBe(false);
});
