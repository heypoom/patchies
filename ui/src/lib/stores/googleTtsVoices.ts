import { get, writable } from 'svelte/store';
import Fuse from 'fuse.js';

export type GoogleVoice = {
	languageCodes: string[];
	name: string;
	ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL' | 'SSML_VOICE_GENDER_UNSPECIFIED';
	naturalSampleRateHertz: number;
};

export interface GoogleTtsVoicesStore {
	voices: GoogleVoice[];
	fuse: Fuse<GoogleVoice> | null;
	loading: boolean;
	error: string | null;
}

const initialState: GoogleTtsVoicesStore = {
	voices: [],
	fuse: null,
	loading: false,
	error: null
};

export const googleTtsVoicesStore = writable<GoogleTtsVoicesStore>(initialState);

export async function fetchGoogleTtsVoices(): Promise<void> {
	const current = get(googleTtsVoicesStore);

	// Already loaded or loading
	if (current.voices.length > 0 || current.loading) {
		return;
	}

	const apiKey = localStorage.getItem('gemini-api-key');
	if (!apiKey) {
		googleTtsVoicesStore.update((s) => ({
			...s,
			error: 'No API key found'
		}));
		return;
	}

	googleTtsVoicesStore.update((s) => ({ ...s, loading: true, error: null }));

	try {
		const response = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`);

		if (!response.ok) {
			throw new Error(`Failed to load voices: ${response.statusText}`);
		}

		const data = await response.json();
		const voices: GoogleVoice[] = data.voices ?? [];

		// Create Fuse index for fast searching
		const fuse = new Fuse(voices, {
			keys: ['name', 'languageCodes', 'ssmlGender'],
			threshold: 0.3
		});

		googleTtsVoicesStore.set({
			voices,
			fuse,
			loading: false,
			error: null
		});
	} catch (error) {
		googleTtsVoicesStore.update((s) => ({
			...s,
			loading: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}));
	}
}

// Search voices using the pre-built Fuse index
export function searchGoogleTtsVoices(query: string, limit = 50): GoogleVoice[] {
	const { fuse } = get(googleTtsVoicesStore);
	if (!fuse || !query) return [];
	return fuse.search(query, { limit }).map((r) => r.item);
}
