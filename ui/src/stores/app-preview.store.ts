import { writable, derived } from 'svelte/store';

export interface AppPreviewState {
  /** Name of the patch/app for display */
  name: string | null;

  /** The generated HTML content */
  html: string | null;

  /** The spec used to generate the HTML (preserved for export) */
  spec: string | null;
}

const defaultState: AppPreviewState = {
  html: null,
  name: null,
  spec: null
};

function createAppPreviewStore() {
  const { subscribe, set } = writable<AppPreviewState>(defaultState);

  return {
    subscribe,

    /**
     * Set the preview content.
     */
    setPreview(html: string, name?: string, spec?: string) {
      set({ html, name: name ?? null, spec: spec ?? null });
    },

    /**
     * Clear the preview.
     */
    clear() {
      set(defaultState);
    }
  };
}

export const appPreviewStore = createAppPreviewStore();

/**
 * Derived store that indicates if there's an active preview.
 */
export const hasAppPreview = derived(appPreviewStore, ($store) => $store.html !== null);
