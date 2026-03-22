export interface ThreadActionRef {
  id: string;
  type: string;
  summary?: string;
  state?: 'applied' | 'dismissed';
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
