import { writable } from 'svelte/store';

export interface TransportSyncState {
  enabled: boolean;
  isLeader: boolean;
  peerCount: number;
}

function createTransportSyncStore() {
  const { subscribe, update } = writable<TransportSyncState>({
    enabled: false,
    isLeader: false,
    peerCount: 0
  });

  return {
    subscribe,

    setEnabled(enabled: boolean) {
      update((s) => ({ ...s, enabled }));
    },

    setIsLeader(isLeader: boolean) {
      update((s) => ({ ...s, isLeader }));
    },

    setPeerCount(peerCount: number) {
      update((s) => ({ ...s, peerCount }));
    }
  };
}

export const transportSyncStore = createTransportSyncStore();
