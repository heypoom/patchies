import { writable } from 'svelte/store';

export interface RvcModel {
	id: string;
	name: string;
}

export interface VoicesData {
	emotionVoices: {
		categories: {
			male: {
				positive: string[];
				neutral: string[];
				casual: string[];
			};
			female: {
				positive: string[];
				neutral: string[];
				calm: string[];
			};
			thai: {
				general: string[];
			};
		};
		available: string[];
	};
	rvcModels: RvcModel[];
}

export interface VoicesStore {
	data: VoicesData | null;
	loading: boolean;
	error: string | null;
	lastFetched: number | null;
}

const initialState: VoicesStore = {
	data: null,
	loading: false,
	error: null,
	lastFetched: null
};

export const voicesStore = writable<VoicesStore>(initialState);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchVoices(): Promise<void> {
	const currentTime = Date.now();

	voicesStore.update((state) => {
		// Check if we have recent cached data
		if (state.data && state.lastFetched && currentTime - state.lastFetched < CACHE_DURATION) {
			return state;
		}

		return { ...state, loading: true, error: null };
	});

	try {
		const response = await fetch('https://api.celestiai.co/api/v1/tts-turbo/voices');

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const json = await response.json();

		if (!json.success) {
			throw new Error('Failed to fetch voices');
		}

		voicesStore.set({
			data: json,
			loading: false,
			error: null,
			lastFetched: currentTime
		});
	} catch (error) {
		voicesStore.update((state) => ({
			...state,
			loading: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}));
	}
}
