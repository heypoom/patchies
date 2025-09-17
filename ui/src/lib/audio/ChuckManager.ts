import type { Chuck } from 'webchuck';
import { match, P } from 'ts-pattern';
import { writable } from 'svelte/store';

export interface ChuckShred {
	id: number;
	time: number;
	code: string;
}

export class ChuckManager {
	private chuck: Chuck | null = null;
	private shreds: ChuckShred[] = [];
	private ready = false;
	private gainNode: GainNode;
	private audioContext: AudioContext;

	/** Allows Svelte to subscribe to the shreds */
	public shredsStore = writable<ChuckShred[]>([]);

	constructor(audioContext: AudioContext, gainNode: GainNode) {
		this.audioContext = audioContext;
		this.gainNode = gainNode;
	}

	async runCode(code: string): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			const shredId = await chuck.runCode(code);
			const now = await chuck.now();

			if (now === 0) {
				console.warn('[chuck] chuck.now() returned 0, chuck is likely broken! reloading.');
				await this.reloadChuck();

				return;
			}

			this.shreds.push({
				id: shredId,
				time: now,
				code: code.trim()
			});

			this.updateStore();
		} catch (error) {
			console.error('ChucK run error:', error);
			throw error;
		}
	}

	async replaceCode(code: string): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			if (this.shreds.length === 0) {
				// if no shreds, just run the code.
				await this.runCode(code);
			} else {
				await chuck.replaceCode(code);
			}

			// Update the most recent shred's code
			if (this.shreds.length > 0) {
				this.shreds[this.shreds.length - 1].code = code.trim();

				this.updateStore();
			}
		} catch (error) {
			console.error('ChucK replace error:', error);
			throw error;
		}
	}

	async removeLastCode(): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			chuck.removeLastCode();

			this.shreds.pop();
			this.updateStore();
		} catch (error) {
			console.error('ChucK remove error:', error);
			throw error;
		}
	}

	async removeShred(shredId: number): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			await chuck.removeShred(shredId);
		} catch {}

		this.shreds = this.shreds.filter((shred) => shred.id !== shredId);
		this.updateStore();
	}

	async clearAll(): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) throw new Error('ChucK not initialized');

		try {
			chuck.clearChuckInstance();
			this.shreds = [];
			this.updateStore();
		} catch (error) {
			console.error('ChucK clear error:', error);
			throw error;
		}
	}

	getShreds(): ChuckShred[] {
		return [...this.shreds];
	}

	getGainNode(): GainNode {
		return this.gainNode;
	}

	async handleMessage(key: string, value: unknown): Promise<void> {
		match([key, value])
			.with(['init', P.any], async () => {
				this.ensureChuck();
			})
			.with(['run', P.string], async ([, code]) => {
				await this.runCode(code);
			})
			.with(['replace', P.string], async ([, code]) => {
				await this.replaceCode(code);
			})
			.with(['remove', P.any], async () => {
				await this.removeLastCode();
			})
			.with(['removeShred', P.number], async ([, shredId]) => {
				await this.removeShred(shredId);
			})
			.with(['clearAll', P.any], async () => {
				await this.clearAll();
			});
	}

	destroy(): void {
		if (this.chuck) {
			try {
				this.chuck.removeLastCode();
			} catch (error) {
				console.error('Failed to cleanup ChucK during destroy:', error);
			}
		}

		this.gainNode.disconnect();
		this.shreds = [];
		this.chuck = null;
		this.ready = false;
	}

	private updateStore() {
		this.shredsStore.set([...this.shreds]);
	}

	async ensureChuck(): Promise<Chuck | null> {
		if (this.ready) return this.chuck;

		try {
			this.reloadChuck();
			this.ready = true;

			return this.chuck;
		} catch (error) {
			console.error('Failed to initialize ChucK:', error);
			return null;
		}
	}

	async reloadChuck() {
		const { Chuck } = await import('webchuck');

		if (this.chuck) {
			this.chuck.clearChuckInstance();
			this.chuck.clearGlobals();
		}

		this.chuck = await Chuck.init([], this.audioContext, 2, './webchuck/');
		this.chuck.connect(this.gainNode);

		this.chuck.addEventListener('processorerror', (event) => {
			console.error('ChucK AudioWorkletProcessor error:', event);
		});

		console.log(`[chuck] reloaded`);
	}
}
