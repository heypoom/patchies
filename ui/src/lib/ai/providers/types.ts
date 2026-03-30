export interface LLMMessage {
  role: 'user' | 'model';
  content: string;
  images?: { mimeType: string; data: string }[];
}

export interface LLMStreamOptions {
  signal?: AbortSignal;

  /** Optional system prompt (prepended before user messages). */
  systemPrompt?: string;

  /** Called with thinking/reasoning text as it streams (provider-dependent). */
  onThinking?: (thought: string) => void;

  /** Called with each text token as it streams. */
  onToken?: (token: string) => void;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Generate text from a list of messages.
   * Streams internally when possible; resolves with the complete response text.
   */
  generateText(messages: LLMMessage[], options?: LLMStreamOptions): Promise<string>;
}
