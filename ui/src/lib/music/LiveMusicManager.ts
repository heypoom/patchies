import { GoogleGenAI } from '@google/genai';
import type { AudioChunk, LiveMusicSession, LiveMusicServerMessage } from '@google/genai';
import { writable } from 'svelte/store';

export type PlaybackState = 'stopped' | 'loading' | 'playing' | 'paused';

export interface Prompt {
	text: string;
	weight: number;
}

export class LiveMusicManager {
	private static instance: LiveMusicManager | null = null;

	private ai: GoogleGenAI | null = null;
	private session: LiveMusicSession | null = null;
	private sessionPromise: Promise<LiveMusicSession> | null = null;

	private filteredPrompts = new Set<string>();
	private nextStartTime = 0;
	private bufferTime = 2;

	public readonly audioContext: AudioContext;
	private outputNode: GainNode;

	private prompts = new Map<string, Prompt>();

	// Global stores
	public readonly playbackState = writable<PlaybackState>('stopped');
	public readonly errorMessage = writable<string | null>(null);
	private currentState: PlaybackState = 'stopped';

	private constructor() {
		const apiKey = localStorage.getItem('gemini-api-key');

		if (!apiKey) {
			throw new Error('Gemini API key not found in localStorage');
		}

		if (!this.ai) {
			this.ai = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });
		}

		this.audioContext = new AudioContext({ sampleRate: 48000 });
		this.outputNode = this.audioContext.createGain();

		// Subscribe to our own store to keep internal state in sync
		this.playbackState.subscribe((state) => {
			this.currentState = state;
		});
	}

	static getInstance(): LiveMusicManager {
		if (!LiveMusicManager.instance) {
			LiveMusicManager.instance = new LiveMusicManager();
		}
		return LiveMusicManager.instance;
	}

	private async getSession(): Promise<LiveMusicSession> {
		if (!this.sessionPromise) {
			this.sessionPromise = this.connect();
		}

		return await this.sessionPromise;
	}

	private async connect(): Promise<LiveMusicSession> {
		if (!this.ai) {
			throw new Error('Lyria AI not initialized');
		}

		this.sessionPromise = this.ai.live.music.connect({
			model: 'lyria-realtime-exp',
			callbacks: {
				onmessage: async (e: LiveMusicServerMessage) => {
					if (e.setupComplete) {
						// Connection established successfully
					}

					if (e.filteredPrompt) {
						this.filteredPrompts = new Set([...this.filteredPrompts, e.filteredPrompt.text!]);
					}

					if (e.serverContent?.audioChunks) {
						await this.processAudioChunks(e.serverContent.audioChunks);
					}
				},
				onerror: (e) => {
					console.log('lyria.error', e.target);

					this.playbackState.set('stopped');
					this.errorMessage.set('Connection error, please restart audio.');
				},
				onclose: (e) => {
					console.log('lyria.close', e.target);

					this.playbackState.set('stopped');
					this.errorMessage.set('Connection error, please restart audio.');
				}
			}
		});

		return this.sessionPromise;
	}

	private async processAudioChunks(audioChunks: AudioChunk[]) {
		if (this.currentState === 'paused' || this.currentState === 'stopped') {
			return;
		}

		console.log('Processing audio chunks:', audioChunks.length);

		// Decode audio data
		const audioData = this.decode(audioChunks[0].data!);
		const audioBuffer = await this.decodeAudioData(audioData, 48000, 2);

		const source = this.audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.outputNode);

		if (this.nextStartTime === 0) {
			this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
			setTimeout(() => {
				this.playbackState.set('playing');
			}, this.bufferTime * 1000);
		}

		if (this.nextStartTime < this.audioContext.currentTime) {
			this.playbackState.set('loading');
			this.nextStartTime = 0;
			return;
		}

		source.start(this.nextStartTime);
		this.nextStartTime += audioBuffer.duration;
	}

	private decode(base64Data: string) {
		const binaryString = atob(base64Data);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes;
	}

	private async decodeAudioData(
		data: Uint8Array,
		sampleRate: number,
		numChannels: number
	): Promise<AudioBuffer> {
		const buffer = this.audioContext.createBuffer(
			numChannels,
			data.length / 2 / numChannels,
			sampleRate
		);

		const dataInt16 = new Int16Array(data.buffer);
		const l = dataInt16.length;
		const dataFloat32 = new Float32Array(l);
		for (let i = 0; i < l; i++) {
			dataFloat32[i] = dataInt16[i] / 32768.0;
		}
		// Extract interleaved channels
		if (numChannels === 0) {
			buffer.copyToChannel(dataFloat32, 0);
		} else {
			for (let i = 0; i < numChannels; i++) {
				const channel = dataFloat32.filter((_, index) => index % numChannels === i);
				buffer.copyToChannel(channel, i);
			}
		}

		return buffer;
	}

	public get activePrompts(): Prompt[] {
		return Array.from(this.prompts.values()).filter((p) => {
			return !this.filteredPrompts.has(p.text) && p.weight !== 0;
		});
	}

	private throttleTimer: ReturnType<typeof setTimeout> | null = null;

	public async setWeightedPrompts(prompts: Map<string, Prompt>) {
		this.prompts = prompts;

		// Throttle the API calls
		if (this.throttleTimer) {
			clearTimeout(this.throttleTimer);
		}

		this.throttleTimer = setTimeout(async () => {
			if (this.activePrompts.length === 0) {
				this.errorMessage.set('There needs to be one active prompt to play.');
				this.pause();
				return;
			}

			if (!this.session) return;

			try {
				await this.session.setWeightedPrompts({
					weightedPrompts: this.activePrompts
				});
			} catch (e: unknown) {
				const message = e instanceof Error ? e.message : String(e);
				this.errorMessage.set(message);
				this.pause();
			}
		}, 200);
	}

	public async play() {
		this.playbackState.set('loading');

		try {
			this.session = await this.getSession();
			await this.setWeightedPrompts(this.prompts);

			await this.audioContext.resume();
			this.session.play();

			this.outputNode.connect(this.audioContext.destination);
			this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
			this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
		} catch (error) {
			this.playbackState.set('stopped');
			this.errorMessage.set(error instanceof Error ? error.message : 'Failed to start playback');
		}
	}

	public pause() {
		if (this.session) {
			this.session.pause();
		}

		this.playbackState.set('paused');
		this.outputNode.gain.setValueAtTime(1, this.audioContext.currentTime);
		this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
		this.nextStartTime = 0;
		this.outputNode = this.audioContext.createGain();
	}

	public stop() {
		if (this.session) {
			this.session.stop();
		}

		this.playbackState.set('stopped');
		this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
		this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
		this.nextStartTime = 0;
		this.session = null;
		this.sessionPromise = null;
	}

	public async playPause() {
		switch (this.currentState) {
			case 'playing':
				return this.pause();
			case 'paused':
			case 'stopped':
				return this.play();
			case 'loading':
				return this.stop();
		}
	}

	// Methods for managing prompts
	public addPrompt(text: string, weight: number = 0.5) {
		const newPrompts = new Map(this.prompts);
		newPrompts.set(text, { text, weight });
		this.setWeightedPrompts(newPrompts);
	}

	public updatePromptWeight(text: string, weight: number) {
		const prompt = this.prompts.get(text);
		if (prompt) {
			const newPrompts = new Map(this.prompts);
			newPrompts.set(text, { ...prompt, weight });
			this.setWeightedPrompts(newPrompts);
		}
	}

	public removePrompt(text: string) {
		const newPrompts = new Map(this.prompts);
		newPrompts.delete(text);
		this.setWeightedPrompts(newPrompts);
	}

	public getPrompts(): Map<string, Prompt> {
		return new Map(this.prompts);
	}

	public setPrompts(weightedPrompts: Record<string, number>) {
		const newPrompts = new Map<string, Prompt>();
		for (const [text, weight] of Object.entries(weightedPrompts)) {
			newPrompts.set(text, { text, weight });
		}
		this.setWeightedPrompts(newPrompts);
	}
}
