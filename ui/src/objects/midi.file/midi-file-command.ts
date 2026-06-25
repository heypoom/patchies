export function isMidiFilePlayMessage(message: unknown): boolean {
  return message === 'bang' || message === 'play' || isMidiFileMessageType(message, 'bang', 'play');
}

export function isMidiFileMessageType(
  message: unknown,
  ...types: string[]
): message is Record<string, unknown> {
  return (
    typeof message === 'object' &&
    message !== null &&
    types.includes((message as { type?: unknown }).type as string)
  );
}
