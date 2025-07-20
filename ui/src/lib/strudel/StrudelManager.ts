import { initStrudel, evaluate, hush, samples } from '@strudel/web';

interface SendMessageOptions {
	type?: string;
	to?: string;
}

interface MessageContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	send: (data: any, options?: SendMessageOptions) => void;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onMessage: (callback: (message: any) => void) => void;

	interval: (callback: () => void, ms: number) => number;
}

export interface StrudelConfig {
	code: string;
	messageContext?: MessageContext;
}

export class StrudelManager {
	private container: HTMLElement | null = null;
	private isInitialized = false;
	private isPlaying = false;

	constructor(container: HTMLElement) {
		this.container = container;
		this.initializeStrudel();
	}

	private async initializeStrudel() {
		try {
			await initStrudel({
				prebake: () => samples('github:tidalcycles/dirt-samples')
			});
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize Strudel:', error);
		}
	}

	async updateCode(config: StrudelConfig) {
		if (!this.isInitialized) {
			console.warn('Strudel not yet initialized');
			return;
		}

		try {
			// Stop any currently playing pattern
			if (this.isPlaying) {
				hush();
				this.isPlaying = false;
			}

			// Execute the new code if provided
			if (config.code.trim()) {
				await evaluate(config.code);
				this.isPlaying = true;
			}
		} catch (error) {
			console.error('Strudel evaluation error:', error);
			throw error;
		}
	}

	play() {
		if (!this.isInitialized) {
			console.warn('Strudel not yet initialized');
			return;
		}
		// Strudel patterns start playing automatically when evaluated
		// This method is here for consistency with P5Manager
	}

	stop() {
		if (!this.isInitialized) return;

		try {
			hush();
			this.isPlaying = false;
		} catch (error) {
			console.error('Error stopping Strudel:', error);
		}
	}

	destroy() {
		this.stop();
		this.container = null;
	}

	getIsPlaying(): boolean {
		return this.isPlaying;
	}

	getIsInitialized(): boolean {
		return this.isInitialized;
	}
}
