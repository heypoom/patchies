import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/search-params', () => ({
  getSearchParam: vi.fn(() => 'room-test'),
  setSearchParam: vi.fn()
}));

const peerEvents = {
  joinHandler: null as ((peerId: string) => void) | null,
  leaveHandler: null as ((peerId: string) => void) | null
};

const listeners = new Map<string, Set<(data: unknown, peerId: string) => void>>();
const mockRoom = {
  onPeerJoin: (cb: (peerId: string) => void) => {
    peerEvents.joinHandler = cb;
  },
  onPeerLeave: (cb: (peerId: string) => void) => {
    peerEvents.leaveHandler = cb;
  },
  makeAction: (channel: string) => {
    let handlerSet = listeners.get(channel);
    if (!handlerSet) {
      handlerSet = new Set();
      listeners.set(channel, handlerSet);
    }

    const send = async (data: unknown, peerId?: string) => {
      handlerSet?.forEach((handler) => handler(data, peerId ?? 'peer-remote'));
      return [];
    };

    const subscribe = (handler: (data: unknown, peerId: string) => void) => {
      handlerSet?.add(handler);
    };

    return [send, subscribe, () => {}] as const;
  },
  getPeers: () => ({}) as Record<string, RTCPeerConnection>,
  leave: vi.fn()
};

const joinRoomMock = vi.fn(() => mockRoom);

vi.mock('trystero', () => ({
  joinRoom: joinRoomMock,
  selfId: 'self-mock'
}));

// Import after mocks
import { P2PManager } from './P2PManager';

describe('P2PManager (Trystero)', () => {
  beforeEach(() => {
    P2PManager.getInstance().destroy();
    listeners.clear();
    peerEvents.joinHandler = null;
    peerEvents.leaveHandler = null;
    joinRoomMock.mockClear();
  });

  it('routes channel messages through trystero actions', async () => {
    const manager = P2PManager.getInstance();
    await manager.initialize();

    const received: Array<{ data: unknown; peerId: string }> = [];
    const unsubscribe = manager.subscribeToChannel('chat', (data, peerId) => {
      received.push({ data, peerId });
    });

    manager.sendToChannel('chat', { ping: true });

    expect(received).toEqual([{ data: { ping: true }, peerId: 'peer-remote' }]);

    unsubscribe();
  });

  it('tracks peer joins and leaves', async () => {
    const manager = P2PManager.getInstance();
    await manager.initialize();

    peerEvents.joinHandler?.('peer-a');
    peerEvents.joinHandler?.('peer-b');

    expect(manager.getPeerCount()).toBe(2);

    peerEvents.leaveHandler?.('peer-a');
    expect(manager.getPeerCount()).toBe(1);
  });
});
