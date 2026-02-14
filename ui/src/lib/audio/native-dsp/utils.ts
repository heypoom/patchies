export const isMessageType = (data: unknown, type: string) =>
  (data as { type: string })?.type === type;
