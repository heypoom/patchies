import { match } from 'ts-pattern';
import {
  getEditorOpenLayout,
  type EditorLayoutPreference
} from '../../stores/editor-layout-settings.store';

interface OpenEditorLayoutOptions {
  defaultLayout: EditorLayoutPreference;
  useAlternateLayout: boolean;
  openInline: () => void;
  toggleInline: () => void;
  openOverlay: () => void;
  openSidebar: () => void;
}

export function openEditorLayout({
  defaultLayout,
  useAlternateLayout,
  openInline,
  toggleInline,
  openOverlay,
  openSidebar
}: OpenEditorLayoutOptions): void {
  const layout = getEditorOpenLayout(defaultLayout, useAlternateLayout);

  match(layout)
    .with('inline', () => {
      if (useAlternateLayout) {
        openInline();
      } else {
        toggleInline();
      }
    })
    .with('overlay', openOverlay)
    .with('sidebar', openSidebar)
    .exhaustive();
}
