export function isBangMessage(message: unknown): message is { type: 'bang' } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === 'bang'
  );
}

export function getNextPeppermintInput<TInput>(
  currentInput: TInput,
  message: unknown
): TInput | unknown {
  if (isBangMessage(message)) {
    return currentInput;
  }

  return message;
}
