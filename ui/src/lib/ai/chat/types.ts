export interface ThreadActionRef {
  id: string;
  type: string;
  summary?: string;
}

export interface StagedImage {
  mimeType: string;
  data: string;
  previewUrl: string;
}

export interface ThreadMessage {
  role: 'user' | 'model';
  content: string;
  thinking?: string;
  actions?: ThreadActionRef[];
  images?: StagedImage[];
}
