import { describe, expect, it, vi } from 'vitest';
import { openEditorLayout } from './open-editor-layout';
import type { EditorLayoutPreference } from '../../stores/editor-layout-settings.store';

function createHandlers() {
  return {
    openInline: vi.fn(),
    toggleInline: vi.fn(),
    openOverlay: vi.fn(),
    openSidebar: vi.fn()
  };
}

function callsFor(defaultLayout: EditorLayoutPreference, useAlternateLayout: boolean) {
  const handlers = createHandlers();

  openEditorLayout({
    defaultLayout,
    useAlternateLayout,
    ...handlers
  });

  return handlers;
}

describe('openEditorLayout', () => {
  it('uses the default layout for plain clicks', () => {
    expect(callsFor('inline', false).toggleInline).toHaveBeenCalledOnce();
    expect(callsFor('overlay', false).openOverlay).toHaveBeenCalledOnce();
    expect(callsFor('sidebar', false).openSidebar).toHaveBeenCalledOnce();
  });

  it('uses the alternate layout for shift clicks', () => {
    expect(callsFor('inline', true).openOverlay).toHaveBeenCalledOnce();
    expect(callsFor('overlay', true).openInline).toHaveBeenCalledOnce();
    expect(callsFor('sidebar', true).openOverlay).toHaveBeenCalledOnce();
  });
});
