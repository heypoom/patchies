import { useKeyboardCallbacks } from '$lib/canvas/use-keyboard-callbacks.svelte';

type Options = {
  getRoot: () => HTMLElement | undefined;
  getPreview: () => HTMLElement | undefined;
  onError: (error: unknown) => void;
};

export function useDomPreviewKeyboard({ getRoot, getPreview, onError }: Options) {
  const keyboard = useKeyboardCallbacks({ onError });

  $effect(() => {
    const preview = getPreview();

    return preview ? keyboard.attach(preview) : undefined;
  });

  function focusPreview() {
    const selector =
      'input, button, select, textarea, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

    const preview = getPreview();

    const control =
      getRoot()?.shadowRoot?.querySelector<HTMLElement>(selector) ??
      preview?.querySelector<HTMLElement>(selector);

    (control ?? preview)?.focus();
  }

  return {
    ...keyboard,
    focusPreview,
    previewAttributes: {
      role: 'application',
      tabindex: 0,
      'aria-label': 'Interactive preview'
    }
  };
}
