import type { MusicCodeLayoutData } from '$lib/music-code-layout/music-code-layout';

export interface StrudelNodeData extends MusicCodeLayoutData {
  code: string;
  fontFamily?: string;
  fontSize?: number;
  expandedFontSize?: number;
  showConsole?: boolean;
  syncTransport?: boolean;
  muted?: boolean;
  styles?: Record<string, string>;
}

export function resolveStrudelFontSizes(
  data: StrudelNodeData,
  defaultFontSize: number,
  defaultExpandedFontSize: number
) {
  const normal = data.fontSize ?? defaultFontSize;
  const expanded = Math.max(normal + 1, data.expandedFontSize ?? defaultExpandedFontSize);

  return { normal, expanded };
}
