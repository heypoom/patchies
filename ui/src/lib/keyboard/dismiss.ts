/**
 * Matches a UI dismissal request.
 *
 * Native browser fullscreen reserves Escape, so Cmd/Ctrl+. provides an
 * application-level alternative for cancelling edits and closing overlays.
 */
export const isDismissKey = (event: KeyboardEvent): boolean =>
  event.key === 'Escape' ||
  !!((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === '.');

export const isExpandedDismissKey = (event: KeyboardEvent): boolean =>
  (event.key === 'Escape' && event.shiftKey) ||
  !!((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key === '.');
