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

// ── Tool calling / multi-turn ──────────────────────────────────────────────────

/** A tool the model can call, using JSON Schema for parameters. */
export interface ToolDeclaration {
  name: string;
  description: string;
  /** Standard JSON Schema object for the function parameters. */
  parametersJsonSchema: Record<string, unknown>;
}

/** A single tool call the model requested. */
export interface ToolCall {
  /** Unique ID for this call (used to match tool results). */
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** A tool result to feed back to the model. */
export interface ToolResult {
  /** Must match the ToolCall.id this result belongs to. */
  callId: string;
  name: string;
  result: unknown;
}

/**
 * A normalized turn in the multi-turn conversation history.
 * Carries both user and model roles, including tool calls and results.
 */
export interface ChatTurnMessage {
  role: 'user' | 'model';
  content: string;
  images?: { mimeType: string; data: string }[];
  /** Gemini-specific: YouTube file URIs to pass as fileData parts. */
  youtubeUrls?: string[];
  /** Model requested these tool calls (model turn). */
  toolCalls?: ToolCall[];
  /** User is providing these tool results (user turn, follows a model turn with toolCalls). */
  toolResults?: ToolResult[];
  /**
   * Provider-specific opaque data. Do not inspect outside the provider.
   * Gemini uses this to preserve thought_signature across multi-turn tool calls.
   */
  _raw?: unknown;
}

export interface StreamTurnOptions {
  systemPrompt?: string;
  tools?: ToolDeclaration[];
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
  onThinking?: (thought: string) => void;
}

export interface StreamTurnResult {
  text: string;
  toolCalls: ToolCall[];

  /**
   * Provider-specific opaque data to store in ChatTurnMessage._raw.
   * Pass it back as-is in subsequent turns so the provider can preserve state
   * (e.g. Gemini thought_signature).
   */
  _rawModelTurn: unknown;
}

// ── Provider interface ─────────────────────────────────────────────────────────

export interface LLMProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Generate text from a list of messages.
   * Streams internally when possible; resolves with the complete response text.
   */
  generateText(messages: LLMMessage[], options?: LLMStreamOptions): Promise<string>;

  /**
   * Stream a single turn of a multi-turn conversation, optionally with tool calling.
   * Resolves once the model finishes its turn (text or tool calls collected).
   * The caller is responsible for executing tool calls and looping.
   */
  streamTurn(messages: ChatTurnMessage[], options: StreamTurnOptions): Promise<StreamTurnResult>;
}
