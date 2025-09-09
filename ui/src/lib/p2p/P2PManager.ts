// @ts-expect-error -- p2pkit does not bundle type for p2pt
import { getSearchParam, setSearchParam } from '$lib/utils/search-params';
import { P2PT as _P2PT } from 'p2pkit';

import type { Peer } from 'p2pt';
import type P2PT from 'p2pt';

/**
 * Public WebTorrent trackers.
 */
const FALLBACK_TRACKER_URLS = [
	'wss://tracker.btorrent.xyz:443',
	'wss://tracker.webtorrent.dev:443',
	'wss://tracker.ghostchu-services.top:443/announce',
	'wss://tracker.files.fm:7073/announce',
	'ws://tracker.ghostchu-services.top:80/announce',
	'ws://tracker.files.fm:7072/announce'
];

const P2PTKit = _P2PT as typeof P2PT;

export type P2PMessageHandler = (data: unknown, peer: Peer) => void;
type P2PMessage = { channel: string; data: unknown };

export class P2PManager {
	private static instance: P2PManager | null = null;
	private p2pt: P2PT | null = null;
	private peers: Record<string, Peer> = {};
	private channels = new Map<string, Set<P2PMessageHandler>>();
	private roomId: string = '';
	private isTrackerListFetched = false;

	private trackerUrls = FALLBACK_TRACKER_URLS;

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
		if (this.p2pt) return;

		await this.ensureTrackersFetched();

		this.p2pt = new P2PTKit(this.trackerUrls, this.roomId);
		if (!this.p2pt) return;

		this.p2pt.on('peerconnect', (peer) => {
			this.peers[peer.id] = peer;
		});

		this.p2pt.on('peerclose', (peer) => {
			delete this.peers[peer.id];
		});

		this.p2pt.on('msg', (peer: Peer, message: P2PMessage) => {
			const handlers = this.channels.get(message.channel);
			if (!handlers) return;

			handlers.forEach((handler) => {
				try {
					handler(message.data, peer);
				} catch (error) {
					console.error('Error handling P2P message:', error);
				}
			});
		});

		this.p2pt.start();
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
		if (!this.p2pt) {
			console.warn('P2P manager not initialized');
			return;
		}

		for (const peerId in this.peers) {
			const peer = this.peers[peerId];

			try {
				this.p2pt!.send(peer, { channel, data } satisfies P2PMessage);
			} catch (error) {
				console.error('Error sending P2P message:', error);
			}
		}
	}

	public getPeerCount(): number {
		return Object.keys(this.peers).length;
	}

	public destroy(): void {
		if (this.p2pt) {
			this.p2pt.destroy();
			this.p2pt = null;
		}

		this.peers = {};
		this.channels.clear();
		P2PManager.instance = null;
	}

	private async ensureTrackersFetched() {
		if (this.isTrackerListFetched) return;

		try {
			const res = await fetch(
				'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_all_ws.txt'
			);

			const text = await res.text();

			const urls = text
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			if (urls.length > 0) {
				this.trackerUrls = urls;
			}
		} catch (error) {
			console.error('[p2p] error fetching tracker list, using fallback trackers:', error);
		} finally {
			this.isTrackerListFetched = true;
		}
	}
}
