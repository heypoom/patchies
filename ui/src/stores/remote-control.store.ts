import { writable } from 'svelte/store';

export interface RemoteControlState {
  enabled: boolean;
  capability: string | null;
}

const initialState: RemoteControlState = { enabled: false, capability: null };

function createCapability(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createRemoteControlStore() {
  const { subscribe, set } = writable<RemoteControlState>(initialState);

  return {
    subscribe,

    enable() {
      set({ enabled: true, capability: createCapability() });
    },

    disable() {
      set(initialState);
    }
  };
}

/** Runtime-only pairing state. It intentionally does not survive an editor reload. */
export const remoteControlStore = createRemoteControlStore();
