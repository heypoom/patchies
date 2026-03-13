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
