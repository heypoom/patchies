export interface MusicCodeSize {
  width: number;
  height: number;
}

export interface MusicCodeLayoutData {
  editorCollapsed?: boolean;
  editorSize?: MusicCodeSize;
  editorResizingEnabled?: boolean;
}

export const DEFAULT_MUSIC_CODE_SIZE: MusicCodeSize = {
  width: 400,
  height: 240
};

export const boundMusicCodeSize = ({ width, height }: MusicCodeSize): MusicCodeSize => ({
  width: Math.max(320, Math.round(width)),
  height: Math.max(120, Math.round(height))
});
