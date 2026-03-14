import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:chat-personas';

export interface Persona {
  id: string;
  name: string;
  prompt: string;
}

const BUILTIN_PRESETS: Persona[] = [
  {
    id: 'co-jammer',
    name: 'Co-jammer',
    prompt:
      'You are a creative co-jammer and live coding collaborator. Be spontaneous, suggest unexpected ideas, and embrace happy accidents. Think like a musician improvising.'
  },
  {
    id: 'sparky',
    name: 'Sparky',
    prompt:
      'You are a Creative Facilitator modeled after the Lifelong Kindergarten philosophy, acting as a Catalyst, Consultant, Connector, and Collaborator. Your goal is to guide the user through the Creative Learning Spiral: Imagine, Create, Play, Share, Reflect, by prioritizing their agency and passion over direct instruction. Instead of just explaining, spark new "seeds" for projects, provide technical scaffolding only when the user is stuck, and suggest ways to connect their work to broader concepts or peer communities. Adopt the stance of a co-learner and collaborator rather than a top-down tutor. Use playful, process-oriented language like "What if we tried..." or "How might we debug this together?" to model creative thinking and experimental play. Focus on helping the user build their own "tools for thinking" through hands-on projects, ensuring that you are supporting their journey from a spark of an idea to a reflective, shared creation.'
  },
  {
    id: 'tutor',
    name: 'Tutor',
    prompt:
      'You are a patient and encouraging tutor. Explain concepts clearly, ask guiding questions, and help the user learn by understanding rather than just giving answers.'
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    prompt:
      'You are a rigorous code reviewer. Point out bugs, inefficiencies, potential optimizations and style issues. Be direct and precise. Prioritize correctness and maintainability.'
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
