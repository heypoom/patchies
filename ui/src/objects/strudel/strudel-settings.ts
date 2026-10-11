import type { MusicCodeLayoutData } from '$lib/music-code-layout/music-code-layout';
import type { EditorAppearanceData } from '$lib/editor-appearance/editor-appearance';

export interface StrudelNodeData extends MusicCodeLayoutData, EditorAppearanceData {
  code: string;
  showConsole?: boolean;
  syncTransport?: boolean;
  muted?: boolean;
}
