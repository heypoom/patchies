import { writable, derived } from 'svelte/store';

export type AiPromptMode = 'single' | 'multi' | 'edit';

export type AiPromptState = {
  isOpen: boolean;
  isLoading: boolean;
  mode: AiPromptMode;
};

const initialState: AiPromptState = {
  isOpen: false,
  isLoading: false,
  mode: 'single'
};

function createAiPromptStore() {
  const { subscribe, set, update } = writable<AiPromptState>(initialState);

  return {
    subscribe,
    open: (mode: AiPromptMode = 'single') => update((state) => ({ ...state, isOpen: true, mode })),
    close: () => update((state) => ({ ...state, isOpen: false, isLoading: false })),
    setLoading: (isLoading: boolean) => update((state) => ({ ...state, isLoading })),
    setMode: (mode: AiPromptMode) => update((state) => ({ ...state, mode })),
    reset: () => set(initialState)
  };
}

export const aiPromptStore = createAiPromptStore();

// Derived stores for convenience
export const isAiPromptOpen = derived(aiPromptStore, ($store) => $store.isOpen);
export const isAiLoading = derived(aiPromptStore, ($store) => $store.isLoading);
export const aiPromptMode = derived(aiPromptStore, ($store) => $store.mode);

// Combined state for button styling
export const aiButtonState = derived(aiPromptStore, ($store) => ({
  isActive: $store.isOpen || $store.isLoading,
  isLoading: $store.isLoading,
  mode: $store.mode
}));
