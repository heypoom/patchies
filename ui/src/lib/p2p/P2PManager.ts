// @ts-ignore - p2pkit doesn't have types
import { P2PT } from 'p2pkit';

const trackersAnnounceURLs = [
	'wss://tracker.btorrent.xyz',
	'wss://tracker.openwebtorrent.com',
	'wss://tracker.fastcast.nz',
	'wss://tracker.novage.com.ua:443/',
	'wss://tracker.files.fm:7073/announce'
];

export type P2PMessageHandler = (data: unknown, peer: unknown) => void;

export class P2PManager {
	private static instance: P2PManager | null = null;
	private p2pt: P2PT | null = null;
	private peers = new Set<unknown>();
	private channels = new Map<string, Set<P2PMessageHandler>>();
	private roomId: string = '';

	private constructor() {
		// Generate or extract room ID from URL hash
		const roomIdMatch = location.hash.match(/^#?([a-zA-Z0-9-]+)/);
		if (roomIdMatch) {
			this.roomId = roomIdMatch[1];
		} else {
			this.roomId = crypto.randomUUID();
			location.replace('#' + this.roomId);
		}
	}

	public static getInstance(): P2PManager {
		if (!P2PManager.instance) {
			P2PManager.instance = new P2PManager();
		}
		return P2PManager.instance;
	}

	public async initialize(): Promise<void> {
		if (this.p2pt) {
			return; // Already initialized
		}

		this.p2pt = new P2PT(trackersAnnounceURLs, this.roomId);

		this.p2pt.on('trackerwarning', (error: unknown, stats: unknown) => {
			// console.warn('P2P tracker warning:', error, stats);
		});

		this.p2pt.on('trackerconnect', (tracker: unknown, stats: unknown) => {
			// console.log('P2P tracker connected:', tracker, stats);
		});

		this.p2pt.on('peerconnect', (peer: unknown) => {
			console.log('P2P peer connected:', peer);
			this.peers.add(peer);
		});

		this.p2pt.on('peerclose', (peer: unknown) => {
			console.log('P2P peer disconnected:', peer);
			this.peers.delete(peer);
		});

		this.p2pt.on('msg', (peer: unknown, message: { channel: string; data: unknown }) => {
			console.log('P2P message received:', message);
			const handlers = this.channels.get(message.channel);
			if (handlers) {
				handlers.forEach((handler) => {
					try {
						handler(message.data, peer);
					} catch (error) {
						console.error('Error handling P2P message:', error);
					}
				});
			}
		});

		this.p2pt.start();
	}

	public subscribeToChannel(channel: string, handler: P2PMessageHandler): () => void {
		if (!this.channels.has(channel)) {
			this.channels.set(channel, new Set());
		}

		const handlers = this.channels.get(channel)!;
		handlers.add(handler);

		// Return unsubscribe function
		return () => {
			handlers.delete(handler);
			if (handlers.size === 0) {
				this.channels.delete(channel);
			}
		};
	}

	public sendToChannel(channel: string, data: unknown): void {
		if (!this.p2pt) {
			console.warn('P2P manager not initialized');
			return;
		}

		const message = { channel, data };
		this.peers.forEach((peer) => {
			try {
				this.p2pt!.send(peer, message);
			} catch (error) {
				console.error('Error sending P2P message:', error);
			}
		});
	}

	public getPeerCount(): number {
		return this.peers.size;
	}

	public getRoomId(): string {
		return this.roomId;
	}

	public destroy(): void {
		if (this.p2pt) {
			this.p2pt.destroy();
			this.p2pt = null;
		}
		this.peers.clear();
		this.channels.clear();
		P2PManager.instance = null;
	}
}
