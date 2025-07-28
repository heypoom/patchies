import { get, writable } from 'svelte/store';

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
}

const initialState: VoicesStore = {
	data: null,
	loading: false,
	error: null
};

export const voicesStore = writable<VoicesStore>(initialState);

export async function fetchVoices(): Promise<void> {
	const currentTime = Date.now();

	const storeResult = get(voicesStore);

	if (storeResult.data !== null) {
		return;
	}

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
