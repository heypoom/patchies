export interface ThreadActionRef {
  id: string;
  type: string;
  summary?: string;
  state?: 'applied' | 'dismissed' | 'failed';
  error?: string;
}

export interface StagedImage {
  mimeType: string;
  data: string;
  previewUrl: string;
}

export interface ThreadToolCall {
  name: string;
  label: string;
  args: Record<string, unknown>;
  output?: unknown;
  /** Accumulated thinking text from subagent (canvas tool calls only) */
  thinking?: string;
  /** True for canvas/subagent tool calls, false for context tool calls */
  isSubagent?: boolean;
  /** True when the tool call was aborted mid-flight by the user */
  aborted?: boolean;
}

export interface ThreadMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
  actions?: ThreadActionRef[];
  toolCalls?: ThreadToolCall[];
  images?: StagedImage[];
  youtubeUrls?: string[];
}
