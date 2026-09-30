import { expect, test } from 'vitest';
import { appendThinking } from './thinking-log';

test('accumulates fragments and Markdown without inserting whitespace', () => {
  let log = appendThinking([], '', { newGeneration: true });

  for (const fragment of ['The', ' user', ' wants **', 'routing', '**.\nNext step.']) {
    log = appendThinking(log, fragment);
  }

  expect(log).toEqual(['The user wants **routing**.\nNext step.']);
});

test('starts a separate block for the next generation', () => {
  let log = appendThinking(['Routing complete.'], '', { newGeneration: true });
  log = appendThinking(log, 'Generate');
  log = appendThinking(log, ' configuration.');

  expect(log).toEqual(['Routing complete.', 'Generate configuration.']);
});

test('does not accumulate empty blocks for generations without reasoning', () => {
  let log = appendThinking([], '', { newGeneration: true });
  log = appendThinking(log, '', { newGeneration: true });
  log = appendThinking(log, 'Thinking');

  expect(log).toEqual(['Thinking']);
});
