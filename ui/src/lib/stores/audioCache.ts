import { writable } from 'svelte/store';

export interface AudioCacheEntry {
	url: string;
	timestamp: number;
	accessCount: number;
	lastAccessed: number;
}

export interface AudioCacheStore {
	entries: Map<string, AudioCacheEntry>;
	maxSize: number;
}

const initialState: AudioCacheStore = {
	entries: new Map(),
	maxSize: 100
};

export const audioCacheStore = writable<AudioCacheStore>(initialState);

export function generateCacheKey(options: {
	text: string;
	emotionVoice: string;
	language: string;
	speed: number;
	volume: number;
	pitch: number;
	voiceId?: string;
}): string {
	if (!options) {
		return '';
	}

	// Create a normalized key from all TTS options
	const normalizedOptions = {
		text: options.text?.trim(),
		emotionVoice: options.emotionVoice,
		language: options.language,
		speed: Math.round(options.speed * 100) / 100, // Round to 2 decimal places
		volume: Math.round(options.volume * 100) / 100,
		pitch: Math.round(options.pitch * 10) / 10, // Round to 1 decimal place
		voiceId: options.voiceId || ''
	};

	// Create a hash-like key from the options
	const keyString = JSON.stringify(normalizedOptions);
	return btoa(keyString)
		.replace(/[^a-zA-Z0-9]/g, '')
		.substring(0, 32);
}

export function getCachedAudio(cacheKey: string): string | null {
	let result: string | null = null;

	audioCacheStore.update((store) => {
		const entry = store.entries.get(cacheKey);
		if (entry) {
			// Update access statistics
			entry.lastAccessed = Date.now();
			entry.accessCount++;
			result = entry.url;
		}
		return store;
	});

	return result;
}

export function setCachedAudio(cacheKey: string, audioUrl: string): void {
	audioCacheStore.update((store) => {
		const now = Date.now();

		// If cache is at max size, remove least recently used entry
		if (store.entries.size >= store.maxSize && !store.entries.has(cacheKey)) {
			let lruKey = '';
			let lruTimestamp = now;

			for (const [key, entry] of store.entries) {
				if (entry.lastAccessed < lruTimestamp) {
					lruTimestamp = entry.lastAccessed;
					lruKey = key;
				}
			}

			if (lruKey) {
				store.entries.delete(lruKey);
			}
		}

		// Add or update the entry
		store.entries.set(cacheKey, {
			url: audioUrl,
			timestamp: now,
			accessCount: 1,
			lastAccessed: now
		});

		return store;
	});
}

export function clearAudioCache(): void {
	audioCacheStore.update((store) => ({
		...store,
		entries: new Map()
	}));
}

export function getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
	let stats = { size: 0, maxSize: 100 };

	audioCacheStore.subscribe((store) => {
		stats = {
			size: store.entries.size,
			maxSize: store.maxSize
		};
	})();

	return stats;
}
