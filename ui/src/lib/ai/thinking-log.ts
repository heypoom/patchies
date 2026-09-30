import type { ThinkingCallback } from './providers/types';

/** Keep provider generations separate while preserving whitespace inside each stream. */
export function appendThinking(
  log: string[],
  text: string,
  event?: Parameters<ThinkingCallback>[1]
): string[] {
  if (event?.newGeneration) {
    return log.length && log[log.length - 1] === '' ? log : [...log, ''];
  }

  if (!text) return log;
  if (!log.length) return [text];

  return [...log.slice(0, -1), log[log.length - 1] + text];
}
