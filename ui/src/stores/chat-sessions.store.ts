import { writable, derived } from 'svelte/store';

export interface ChatSession {
  id: string;
  name: string;
}

interface ChatSessionsState {
  sessions: ChatSession[];
  activeId: string;
}

let counter = 1;

const defaultSession: ChatSession = { id: 'chat-1', name: 'Chat 1' };

function createChatSessionsStore() {
  const { subscribe, update } = writable<ChatSessionsState>({
    sessions: [defaultSession],
    activeId: defaultSession.id
  });

  return {
    subscribe,

    setActive(id: string) {
      update((s) => ({ ...s, activeId: id }));
    },

    addSession() {
      counter++;
      const id = `chat-${counter}`;
      const name = `Chat ${counter}`;
      update((s) => ({
        sessions: [...s.sessions, { id, name }],
        activeId: id
      }));
    },

    removeSession(id: string) {
      update((s) => {
        if (s.sessions.length <= 1) return s;
        const idx = s.sessions.findIndex((sess) => sess.id === id);
        const sessions = s.sessions.filter((sess) => sess.id !== id);
        const activeId = s.activeId === id ? sessions[Math.max(0, idx - 1)].id : s.activeId;
        return { sessions, activeId };
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
