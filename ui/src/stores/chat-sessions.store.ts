import { writable } from 'svelte/store';
import { deleteChatMessages } from './chat-history.store';

export interface ChatSession {
  id: string;
  name: string;
}

interface ChatSessionsState {
  sessions: ChatSession[];
  activeId: string;
  counter: number;
}

const STORAGE_KEY = 'patchies:chat-sessions';
const DRAFTS_KEY = 'patchies:chat-drafts';

const defaultSession: ChatSession = { id: 'chat-1', name: 'Chat 1' };

function loadFromStorage(): ChatSessionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ChatSessionsState;
  } catch {
    // ignore
  }

  return { sessions: [defaultSession], activeId: defaultSession.id, counter: 1 };
}

function saveToStorage(state: ChatSessionsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// --- Drafts: stored outside the reactive store to avoid update loops ---

function loadDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function persistDrafts(d: Record<string, string>): void {
  try {
    if (Object.keys(d).length > 0) {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(d));
    } else {
      localStorage.removeItem(DRAFTS_KEY);
    }
  } catch {
    // ignore
  }
}

const _drafts = loadDrafts();

export function getDraft(sessionId: string): string {
  return _drafts[sessionId] ?? '';
}

export function setDraft(sessionId: string, text: string): void {
  if (text) {
    _drafts[sessionId] = text;
  } else {
    delete _drafts[sessionId];
  }
  persistDrafts(_drafts);
}

function removeDraft(sessionId: string): void {
  delete _drafts[sessionId];
  persistDrafts(_drafts);
}

// --- Store ---

function createChatSessionsStore() {
  const { subscribe, update } = writable<ChatSessionsState>(loadFromStorage());

  subscribe((state) => saveToStorage(state));

  return {
    subscribe,

    setActive(id: string) {
      update((s) => ({ ...s, activeId: id }));
    },

    addSession() {
      update((s) => {
        const counter = s.counter + 1;
        const id = `chat-${counter}`;
        const name = `Chat ${counter}`;

        return {
          sessions: [...s.sessions, { id, name }],
          activeId: id,
          counter
        };
      });
    },

    removeSession(id: string) {
      deleteChatMessages(id);
      removeDraft(id);

      update((s) => {
        if (s.sessions.length <= 1) return s;

        const idx = s.sessions.findIndex((sess) => sess.id === id);
        const sessions = s.sessions.filter((sess) => sess.id !== id);
        const activeId = s.activeId === id ? sessions[Math.max(0, idx - 1)].id : s.activeId;

        return { ...s, sessions, activeId };
      });
    },

    renameSession(id: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) return;

      update((s) => ({
        ...s,
        sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, name: trimmed } : sess))
      }));
    }
  };
}

export const chatSessionsStore = createChatSessionsStore();
