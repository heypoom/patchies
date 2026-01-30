import { joinRoom, selfId, type DataPayload, type Room } from 'trystero';
import { getSearchParam, setSearchParam } from '$lib/utils/search-params';

export type P2PMessageHandler = (data: unknown, peerId: string) => void;
export type P2PConnectionState = 'disconnected' | 'connecting' | 'connected';

type ChannelEntry = {
  send: (data: DataPayload, peerId?: string | string[] | null) => Promise<void[]>;
  handlers: Set<P2PMessageHandler>;
};

/**
 * P2P Manager using Trystero for WebRTC-based peer-to-peer communication.
 * Trystero handles peer discovery and full-mesh room connections for us.
 */
export class P2PManager {
  private static instance: P2PManager | null = null;
  private room: Room | null = null;
  private channels = new Map<string, ChannelEntry>();
  private roomId: string = '';
  private peers = new Set<string>();
  private initializePromise: Promise<void> | null = null;
  private connectionState: P2PConnectionState = 'disconnected';

  private constructor() {
    const room = getSearchParam('room');

    if (room) {
      this.roomId = room;
    } else {
      this.roomId = crypto.randomUUID();
      setSearchParam('room', this.roomId);
    }
  }

  public static getInstance(): P2PManager {
    if (!P2PManager.instance) {
      P2PManager.instance = new P2PManager();
    }

    return P2PManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.room) return;
    if (this.initializePromise) return this.initializePromise;

    this.connectionState = 'connecting';
    this.initializePromise = this._initialize();

    return this.initializePromise;
  }

  private async _initialize(): Promise<void> {
    const config = { appId: 'patchies' };

    this.room = joinRoom(config, this.roomId);

    this.room.onPeerJoin((peerId) => {
      this.peers.add(peerId);
    });

    this.room.onPeerLeave((peerId) => {
      this.peers.delete(peerId);
    });

    const currentPeers = this.room.getPeers();
    Object.keys(currentPeers).forEach((peerId) => this.peers.add(peerId));

    this.connectionState = 'connected';
  }

  public subscribeToChannel(channel: string, handler: P2PMessageHandler): () => void {
    const entry = this.ensureChannelEntry(channel);
    if (!entry) return () => {};

    entry.handlers.add(handler);

    return () => {
      entry.handlers.delete(handler);

      if (entry.handlers.size === 0) {
        this.channels.delete(channel);
      }
    };
  }

  public sendToChannel(channel: string, data: unknown): void {
    const entry = this.ensureChannelEntry(channel);
    if (!entry) return;

    entry.send(data as DataPayload).catch((error) => {
      console.error('[p2p] Error sending to peers:', error);
    });
  }

  public getPeerCount(): number {
    return this.peers.size;
  }

  public getConnectionState(): P2PConnectionState {
    return this.connectionState;
  }

  public isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  public getMyPeerId(): string {
    return selfId ?? '';
  }

  public getRoomId(): string {
    return this.roomId;
  }

  public destroy(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }

    this.channels.clear();
    this.peers.clear();
    this.connectionState = 'disconnected';
    this.initializePromise = null;
    P2PManager.instance = null;
  }

  private ensureChannelEntry(channel: string): ChannelEntry | null {
    if (!this.room) {
      console.warn('[p2p] P2P manager not initialized. Call initialize() first.');
      return null;
    }

    const existing = this.channels.get(channel);
    if (existing) return existing;

    const handlers = new Set<P2PMessageHandler>();
    const [send, onMessage] = this.room.makeAction(channel);
    onMessage((data, peerId) => {
      handlers.forEach((handler) => {
        try {
          handler(data, peerId);
        } catch (error) {
          console.error('[p2p] Error handling message:', error);
        }
      });
    });

    const entry: ChannelEntry = { send, handlers };
    this.channels.set(channel, entry);

    return entry;
  }
}
