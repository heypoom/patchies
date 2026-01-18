import { Peer, type DataConnection } from 'peerjs';
import { getSearchParam, setSearchParam } from '$lib/utils/search-params';

export type P2PMessageHandler = (data: unknown, peerId: string) => void;
export type P2PConnectionState = 'disconnected' | 'connecting' | 'connected';

type P2PMessage = { channel: string; data: unknown };
type PeerListMessage = { type: 'peer-list'; peers: string[] };
type P2PInternalMessage = P2PMessage | PeerListMessage;

const RECONNECT_INTERVAL = 3000;
const PEER_BROADCAST_INTERVAL = 5000;
const DISCOVERY_SLOTS = 10; // Number of well-known peer slots for discovery

/**
 * P2P Manager using PeerJS for WebRTC-based peer-to-peer communication.
 *
 * Uses a full mesh network where all peers connect to all other peers.
 * Peer IDs are persisted in localStorage so peers can reconnect after reload.
 * All peers broadcast their known peer list periodically.
 */
export class P2PManager {
	private static instance: P2PManager | null = null;
	private peer: Peer | null = null;
	private connections = new Map<string, DataConnection>();
	private channels = new Map<string, Set<P2PMessageHandler>>();
	private roomId: string = '';
	private myPeerId: string = '';
	private knownPeerIds = new Set<string>();
	private initializePromise: Promise<void> | null = null;
	private connectionState: P2PConnectionState = 'disconnected';
	private reconnectInterval: ReturnType<typeof setInterval> | null = null;
	private broadcastInterval: ReturnType<typeof setInterval> | null = null;

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
		if (this.peer) return;
		if (this.initializePromise) return this.initializePromise;

		this.connectionState = 'connecting';
		this.initializePromise = this._initialize();

		return this.initializePromise;
	}

	private async _initialize(): Promise<void> {
		// Try to claim a well-known slot (0, 1, 2, ...) for peer discovery
		for (let slot = 0; slot < DISCOVERY_SLOTS; slot++) {
			const slotPeerId = `${this.roomId}-${slot}`;

			try {
				await this.tryConnectWithId(slotPeerId);
				console.log('[p2p] claimed discovery slot:', slot);
				return;
			} catch {
				// Slot taken, try next one
			}
		}

		// All slots taken, use random ID (can still receive connections from others)
		const randomPeerId = `${this.roomId}-${crypto.randomUUID().slice(0, 8)}`;

		await this.tryConnectWithId(randomPeerId);
	}

	private tryConnectWithId(peerId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.peer = new Peer(peerId);

			this.peer.on('open', (id) => {
				this.myPeerId = id;
				this.connectionState = 'connected';
				console.log('[p2p] Connected with peer ID:', id);

				// Start reconnection loop and peer broadcast
				this.startReconnectLoop();
				this.startPeerBroadcast();

				// Try to connect to other well-known slots
				this.connectToDiscoverySlots();

				resolve();
			});

			this.peer.on('connection', (conn) => {
				this.setupConnection(conn);
			});

			this.peer.on('error', (err) => {
				// ID taken - reject so we try next slot
				if (err.type === 'unavailable-id') {
					this.peer?.destroy();
					this.peer = null;
					reject(err);
					return;
				}
			});

			this.peer.on('disconnected', () => {
				this.peer?.reconnect();
			});
		});
	}

	private connectToDiscoverySlots(): void {
		if (!this.peer) return;

		// Try to connect to all well-known slots (except ourselves)
		for (let slot = 0; slot < DISCOVERY_SLOTS; slot++) {
			const slotPeerId = `${this.roomId}-${slot}`;
			if (slotPeerId !== this.myPeerId && !this.connections.has(slotPeerId)) {
				const conn = this.peer.connect(slotPeerId, { reliable: true });
				this.setupConnection(conn);
			}
		}
	}

	private startReconnectLoop(): void {
		if (this.reconnectInterval) return;

		this.reconnectInterval = setInterval(() => {
			this.tryReconnectToKnownPeers();
		}, RECONNECT_INTERVAL);
	}

	private startPeerBroadcast(): void {
		if (this.broadcastInterval) return;

		this.broadcastInterval = setInterval(() => {
			this.broadcastPeerList();
		}, PEER_BROADCAST_INTERVAL);
	}

	private tryReconnectToKnownPeers(): void {
		if (!this.peer) return;

		// Try to connect to any known peers we're not connected to
		for (const peerId of this.knownPeerIds) {
			if (peerId !== this.myPeerId && !this.connections.has(peerId)) {
				console.log('[p2p] trying to reconnect to', peerId);
				const conn = this.peer.connect(peerId, { reliable: true });
				this.setupConnection(conn);
			}
		}
	}

	private broadcastPeerList(): void {
		if (this.connections.size === 0) return;

		// Include ourselves and all connected peers in the list
		const allPeers = [this.myPeerId, ...Array.from(this.connections.keys())];
		const message: PeerListMessage = { type: 'peer-list', peers: allPeers };

		for (const conn of this.connections.values()) {
			try {
				if (conn.open) {
					conn.send(message);
				}
			} catch (error) {
				console.error('[p2p] Error broadcasting peer list:', error);
			}
		}
	}

	private setupConnection(conn: DataConnection): void {
		// Don't setup duplicate connections
		if (this.connections.has(conn.peer)) {
			return;
		}

		conn.on('open', () => {
			this.connections.set(conn.peer, conn);
			this.knownPeerIds.add(conn.peer);

			// Send our peer list to the new connection
			const allPeers = [this.myPeerId, ...Array.from(this.connections.keys())];
			conn.send({ type: 'peer-list', peers: allPeers } satisfies PeerListMessage);
		});

		conn.on('data', (rawData) => {
			const data = rawData as P2PInternalMessage;

			// Handle peer list message (for mesh network setup)
			if (data && typeof data === 'object' && 'type' in data && data.type === 'peer-list') {
				this.handlePeerList(data.peers);
				return;
			}

			// Handle channel messages
			if (data && typeof data === 'object' && 'channel' in data) {
				const message = data as P2PMessage;
				const handlers = this.channels.get(message.channel);
				if (!handlers) return;

				handlers.forEach((handler) => {
					try {
						handler(message.data, conn.peer);
					} catch (error) {
						console.error('[p2p] Error handling message:', error);
					}
				});
			}
		});

		conn.on('close', () => {
			// Keep the peer ID in knownPeerIds so we can try to reconnect
			this.connections.delete(conn.peer);
		});

		conn.on('error', (err) => {
			console.error('[p2p] connection error with', conn.peer, ':', err);
			this.connections.delete(conn.peer);
		});
	}

	private handlePeerList(peers: string[]): void {
		if (!this.peer) return;

		// Add all peers to our known list and try to connect
		for (const peerId of peers) {
			if (peerId !== this.myPeerId) {
				this.knownPeerIds.add(peerId);

				// Connect to peers we don't have connections with
				if (!this.connections.has(peerId)) {
					console.log('[p2p] Connecting to peer from list:', peerId);
					const conn = this.peer.connect(peerId, { reliable: true });
					this.setupConnection(conn);
				}
			}
		}
	}

	public subscribeToChannel(channel: string, handler: P2PMessageHandler): () => void {
		if (!this.channels.has(channel)) {
			this.channels.set(channel, new Set());
		}

		const handlers = this.channels.get(channel)!;
		handlers.add(handler);

		return () => {
			handlers.delete(handler);

			if (handlers.size === 0) {
				this.channels.delete(channel);
			}
		};
	}

	public sendToChannel(channel: string, data: unknown): void {
		if (!this.peer) {
			console.warn('[p2p] P2P manager not initialized');
			return;
		}

		const message: P2PMessage = { channel, data };

		for (const [peerId, conn] of this.connections) {
			try {
				if (conn.open) {
					conn.send(message);
				}
			} catch (error) {
				console.error('[p2p] Error sending to peer', peerId, ':', error);
			}
		}
	}

	public getPeerCount(): number {
		return this.connections.size;
	}

	public getConnectionState(): P2PConnectionState {
		return this.connectionState;
	}

	public isConnected(): boolean {
		return this.connectionState === 'connected';
	}

	public getMyPeerId(): string {
		return this.myPeerId;
	}

	public getRoomId(): string {
		return this.roomId;
	}

	public destroy(): void {
		// Stop intervals
		if (this.reconnectInterval) {
			clearInterval(this.reconnectInterval);
			this.reconnectInterval = null;
		}
		if (this.broadcastInterval) {
			clearInterval(this.broadcastInterval);
			this.broadcastInterval = null;
		}

		// Close all connections
		for (const conn of this.connections.values()) {
			conn.close();
		}
		this.connections.clear();

		if (this.peer) {
			this.peer.destroy();
			this.peer = null;
		}

		this.channels.clear();
		this.knownPeerIds.clear();
		this.connectionState = 'disconnected';
		this.initializePromise = null;
		P2PManager.instance = null;
	}
}
