import { expect, test, vi } from 'vitest';
import { toast } from 'svelte-sonner';

import { AiResponseError } from './parse-object-response';

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

test('AI Edit keeps a failed prompt editable and clears the failure on retry', async () => {
  const onEditObject = vi.fn();
  const controller = createAiPromptController({ ...callbacks, onEditObject });

  const prompt = 'Draw stars\nUse blue and violet, and animate their brightness.';
  const responseText = 'Which background color would you like?';

  controller.open('edit');
  controller.promptText = prompt;

  runModeResolver.mockRejectedValueOnce(new AiResponseError('Expected JSON', responseText));

  await expect(controller.submit()).resolves.toBe(false);

  expect(controller.promptText).toBe(prompt);
  expect(controller.errorMessage).toBe('Expected JSON');
  expect(controller.failedResponse).toBe(responseText);
  expect(toast.error).not.toHaveBeenCalled();
  expect(onEditObject).not.toHaveBeenCalled();

  controller.promptText = `${prompt}\nUse a black background.`;

  runModeResolver.mockImplementationOnce(async (_mode, submittedPrompt) => {
    expect(submittedPrompt).toBe(`${prompt}\nUse a black background.`);
    expect(controller.errorMessage).toBeNull();
    expect(controller.failedResponse).toBeNull();

    return { kind: 'edit', nodeId: 'stars', data: { code: 'drawStars();' } };
  });

  await expect(controller.submit()).resolves.toBe(true);

  expect(onEditObject).toHaveBeenCalledWith('stars', { code: 'drawStars();' });
});

test('AI Edit exposes successful explanations and clears them before the next request', async () => {
  const onEditObject = vi.fn();

  const controller = createAiPromptController({ ...callbacks, onEditObject });
  controller.open('edit');
  controller.promptText = 'Gray circular knob';

  runModeResolver.mockResolvedValueOnce({
    kind: 'edit',
    nodeId: 'knob',
    data: { code: 'drawKnob();' },
    explanation: '**Controls**\n- Drag to change the value.'
  });

  await expect(controller.submit()).resolves.toBe(true);

  expect(onEditObject).toHaveBeenCalledWith('knob', { code: 'drawKnob();' });
  expect(controller.explanation).toBe('**Controls**\n- Drag to change the value.');
  expect(controller.promptText).toBe('Gray circular knob');
  expect(controller.errorMessage).toBeNull();

  controller.promptText = 'Make it blue';

  runModeResolver.mockImplementationOnce(async () => {
    expect(controller.explanation).toBeNull();

    throw new Error('Provider disconnected');
  });

  await expect(controller.submit()).resolves.toBe(false);

  expect(controller.explanation).toBeNull();
  expect(controller.promptText).toBe('Make it blue');
});
