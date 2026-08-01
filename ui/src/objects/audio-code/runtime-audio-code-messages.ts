const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isRunMessage = (value: unknown): boolean =>
  isRecord(value) && isRecord(value.message) && value.message.type === 'run';
