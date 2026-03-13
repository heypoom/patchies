import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:chat-personas';

export interface Persona {
  id: string;
  name: string;
  prompt: string;
}

const BUILTIN_PRESETS: Persona[] = [
  {
    id: 'tutor',
    name: 'Tutor',
    prompt:
      'You are a patient and encouraging tutor. Explain concepts clearly, ask guiding questions, and help the user learn by understanding rather than just giving answers.'
  },
  {
    id: 'co-jammer',
    name: 'Co-jammer',
    prompt:
      'You are a creative co-jammer and live coding collaborator. Be spontaneous, suggest unexpected ideas, and embrace happy accidents. Think like a musician improvising.'
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    prompt:
      'You are a rigorous code reviewer. Point out bugs, inefficiencies, and style issues. Be direct and precise. Prioritize correctness and maintainability.'
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    prompt:
      'You are extremely concise. Never use more words than necessary. Respond with code or short sentences only.'
  }
];

export interface PersonaStoreState {
  /** null = no persona (default assistant) */
  activeId: string | null;
  /** User-created custom personas */
  custom: Persona[];
}

const defaultState: PersonaStoreState = {
  activeId: null,
  custom: []
};

function loadFromStorage(): PersonaStoreState {
  if (typeof localStorage === 'undefined') return defaultState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored);
    return {
      activeId: parsed.activeId ?? null,
      custom: Array.isArray(parsed.custom) ? parsed.custom : []
    };
  } catch {
    return defaultState;
  }
}

function saveToStorage(state: PersonaStoreState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function createPersonaStore() {
  const { subscribe, update } = writable<PersonaStoreState>(loadFromStorage());

  subscribe((state) => saveToStorage(state));

  return {
    subscribe,

    /** All personas: builtins + user custom */
    get allPersonas(): Persona[] {
      return [...BUILTIN_PRESETS, ...loadFromStorage().custom];
    },

    setActive(id: string | null) {
      update((s) => ({ ...s, activeId: id }));
    },

    addCustom(name: string, prompt: string): Persona {
      const persona: Persona = { id: crypto.randomUUID(), name, prompt };
      update((s) => ({ ...s, custom: [...s.custom, persona] }));
      return persona;
    },

    updateCustom(id: string, name: string, prompt: string) {
      update((s) => ({
        ...s,
        custom: s.custom.map((p) => (p.id === id ? { ...p, name, prompt } : p))
      }));
    },

    removeCustom(id: string) {
      update((s) => ({
        ...s,
        custom: s.custom.filter((p) => p.id !== id),
        activeId: s.activeId === id ? null : s.activeId
      }));
    }
  };
}

export const personaStore = createPersonaStore();
export { BUILTIN_PRESETS };
