import { openDB, type IDBPDatabase } from 'idb';
import type { ThreadMessage } from '$lib/ai/chat/types';

const DB_NAME = 'patchies_chat_history';
const DB_VERSION = 1;
const STORE = 'messages';

// Images are excluded from persistence (can be large base64 blobs)
type PersistedMessage = Omit<ThreadMessage, 'images'>;

interface ChatHistoryDB {
  messages: {
    key: string;
    value: PersistedMessage[];
  };
}

let dbPromise: Promise<IDBPDatabase<ChatHistoryDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ChatHistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChatHistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      }
    });
  }
  return dbPromise;
}

export async function loadChatMessages(sessionId: string): Promise<PersistedMessage[]> {
  try {
    const db = await getDb();
    return (await db.get(STORE, sessionId)) ?? [];
  } catch {
    return [];
  }
}

export async function saveChatMessages(
  sessionId: string,
  messages: ThreadMessage[]
): Promise<void> {
  try {
    const db = await getDb();
    // Strip images before persisting
    const persisted: PersistedMessage[] = messages.map(({ images: _images, ...rest }) => rest);
    await db.put(STORE, persisted, sessionId);
  } catch {
    // Ignore write errors
  }
}

export async function deleteChatMessages(sessionId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, sessionId);
  } catch {
    // Ignore delete errors
  }
}
