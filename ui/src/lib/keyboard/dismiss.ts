/**
 * Matches a UI dismissal request.
 *
 * Native browser fullscreen reserves Escape, so Cmd/Ctrl+. provides an
 * application-level alternative for cancelling edits and closing overlays.
 */
export const isDismissKey = (event: KeyboardEvent): boolean =>
  event.key === 'Escape' ||
  !!((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === '.');

export const isExpandedDismissKey = isDismissKey;

export const isNativeFullscreen = readable(false, (set) => {
  if (typeof document === 'undefined') return;

  const update = () => set(document.fullscreenElement !== null);

  update();
  document.addEventListener('fullscreenchange', update);

  return () => document.removeEventListener('fullscreenchange', update);
});

const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

export const getDismissShortcutLabel = (
  nativeFullscreen: boolean,
  isMac: boolean = isMacPlatform()
): string => (nativeFullscreen ? `${isMac ? 'Cmd' : 'Ctrl'} + .` : 'Esc');

export const getExpandedDismissShortcutLabel = getDismissShortcutLabel;
import { readable } from 'svelte/store';
