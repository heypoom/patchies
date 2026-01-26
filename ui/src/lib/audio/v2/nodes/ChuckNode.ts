import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import { MessageContext } from '$lib/messages/MessageContext';
import type { Chuck } from 'webchuck';
import { writable } from 'svelte/store';
import { getChuckGlobalVariableArrayType, getChuckGlobalVariableType } from '../chuck-helpers';

export interface ChuckShred {
	id: number;
	time: number;
	code: string;
}

/**
 * ChuckNode implements the chuck~ audio node.
 * Executes ChucK code for strongly-timed, concurrent audio synthesis.
 */
export class ChuckNode implements AudioNodeV2 {
	static type = 'chuck~';
	static group: AudioNodeGroup = 'processors';
	static description = 'ChucK strongly-timed concurrent audio programming';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio input (accessible via adc in ChucK code)'
		},
		{
			name: 'msg',
			type: 'message',
			description: 'Control input (code, bang, stop)'
		}
	];

	static outlets: ObjectOutlet[] = [
		{ name: 'out', type: 'signal', description: 'Audio output' },
		{ name: 'msg', type: 'message', description: 'Message output (print)' }
	];

	// Output gain node
	audioNode: GainNode;

	readonly nodeId: string;

	private audioContext: AudioContext;
	private messageContext: MessageContext;

	// ChucK state
	private chuck: Chuck | null = null;
	private shreds: ChuckShred[] = [];
	private ready = false;
	private pendingInputConnections: AudioNode[] = [];
	private eventListenerIds: Map<string, number> = new Map();

	/** Allows Svelte to subscribe to the shreds */
	public shredsStore = writable<ChuckShred[]>([]);

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;

		// Create gain node immediately for connections
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;

		this.messageContext = new MessageContext(nodeId);
	}

	async create(): Promise<void> {
		await this.ensureChuck();
	}

	async send(key: string, value: unknown): Promise<void> {
		await match([key, value])
			.with(['init', P.any], async () => {
				await this.ensureChuck();
			})
			.with(['add', P.string], async ([, code]) => {
				await this.addShredCode(code);
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
			})
			.with(['signal', { event: P.string }], ([, m]) => {
				this.chuck?.signalEvent(m.event);
			})
			.with(['broadcast', { event: P.string }], ([, m]) => {
				this.chuck?.broadcastEvent(m.event);
			})
			.with(['set', { key: P.string, value: P.string }], async ([, m]) => {
				this.chuck?.setString(m.key, m.value);
			})
			.with(['set', { key: P.string, value: P.array(P.number) }], async ([, m]) => {
				const currentShred = this.shreds.at(-1);
				if (!currentShred) return;

				const varType = getChuckGlobalVariableArrayType(currentShred?.code, m.key);

				if (varType == 'float' || m.value.every((num) => !Number.isInteger(num))) {
					this.chuck?.setFloatArray(m.key, m.value);
				} else {
					this.chuck?.setIntArray(m.key, m.value);
				}
			})
			.with(['set', { key: P.string, value: P.number }], async ([, m]) => {
				const currentShred = this.shreds.at(-1);
				if (!currentShred) return;

				const varType = getChuckGlobalVariableType(currentShred?.code, m.key);

				if (varType == 'float' || !Number.isInteger(m.value)) {
					this.chuck?.setFloat(m.key, m.value);
				} else {
					this.chuck?.setInt(m.key, m.value);
				}
			})
			.with(['setInt', { key: P.string, value: P.number }], async ([, m]) => {
				this.chuck?.setInt(m.key, m.value);
			})
			.with(['setFloat', { key: P.string, value: P.number }], async ([, m]) => {
				this.chuck?.setFloat(m.key, m.value);
			})
			.with(['setIntArray', { key: P.string, value: P.array(P.number) }], async ([, m]) => {
				this.chuck?.setIntArray(m.key, m.value);
			})
			.with(['setFloatArray', { key: P.string, value: P.array(P.number) }], async ([, m]) => {
				this.chuck?.setFloatArray(m.key, m.value);
			})
			.with(['get', { key: P.string }], async ([, m]) => {
				if (!this.chuck) return;

				const currentShred = this.shreds.at(-1);
				if (!currentShred) return;

				// Detect type from code and call appropriate getter
				const varType = getChuckGlobalVariableType(currentShred.code, m.key);
				const arrayType = getChuckGlobalVariableArrayType(currentShred.code, m.key);

				let value: unknown;
				if (arrayType === 'int') {
					value = await this.chuck.getIntArray(m.key);
				} else if (arrayType === 'float') {
					value = await this.chuck.getFloatArray(m.key);
				} else if (varType === 'int') {
					value = await this.chuck.getInt(m.key);
				} else if (varType === 'float') {
					value = await this.chuck.getFloat(m.key);
				} else if (varType === 'string') {
					value = await this.chuck.getString(m.key);
				} else {
					// Default to float for unknown types
					value = await this.chuck.getFloat(m.key);
				}

				this.messageContext.send({ key: m.key, value });
			})
			.with(['getInt', { key: P.string }], async ([, m]) => {
				const value = await this.chuck?.getInt(m.key);
				if (value !== undefined) this.messageContext.send({ key: m.key, value });
			})
			.with(['getFloat', { key: P.string }], async ([, m]) => {
				const value = await this.chuck?.getFloat(m.key);
				if (value !== undefined) this.messageContext.send({ key: m.key, value });
			})
			.with(['getString', { key: P.string }], async ([, m]) => {
				const value = await this.chuck?.getString(m.key);
				if (value !== undefined) this.messageContext.send({ key: m.key, value });
			})
			.with(['getIntArray', { key: P.string }], async ([, m]) => {
				const value = await this.chuck?.getIntArray(m.key);
				if (value !== undefined) this.messageContext.send({ key: m.key, value });
			})
			.with(['getFloatArray', { key: P.string }], async ([, m]) => {
				const value = await this.chuck?.getFloatArray(m.key);
				if (value !== undefined) this.messageContext.send({ key: m.key, value });
			})
			.with(['listenOnce', { event: P.string }], ([, m]) => {
				this.chuck?.listenForEventOnce(m.event, () => {
					this.messageContext.send({ event: m.event });
				});
			})
			.with(['listenStart', { event: P.string }], ([, m]) => {
				// Stop existing listener if any
				const existingId = this.eventListenerIds.get(m.event);
				if (existingId !== undefined) {
					this.chuck?.stopListeningForEvent(m.event, existingId);
				}

				const callbackId = this.chuck?.startListeningForEvent(m.event, () => {
					this.messageContext.send({ event: m.event });
				});

				if (callbackId !== undefined) {
					this.eventListenerIds.set(m.event, callbackId);
				}
			})
			.with(['listenStop', { event: P.string }], ([, m]) => {
				const callbackId = this.eventListenerIds.get(m.event);
				if (callbackId !== undefined) {
					this.chuck?.stopListeningForEvent(m.event, callbackId);
					this.eventListenerIds.delete(m.event);
				}
			})
			.run();
	}

	async addShredCode(code: string): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			const shredId = await chuck.runCode(code);
			const now = await chuck.now();

			if (now === 0) {
				logger.warn('[chuck~] chuck.now() returned 0, chuck is likely broken! reloading.');
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
			logger.error('chuck~ run error:', error);
			throw error;
		}
	}

	async replaceCode(code: string): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			if (this.shreds.length === 0) {
				// if no shreds, just run the code.
				await this.addShredCode(code);
			} else {
				await chuck.replaceCode(code);
			}

			// Update the most recent shred's code
			if (this.shreds.length > 0) {
				this.shreds[this.shreds.length - 1].code = code.trim();
				this.updateStore();
			}
		} catch (error) {
			logger.error('chuck~ replace error:', error);
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
			logger.error('chuck~ remove error:', error);
			throw error;
		}
	}

	async removeShred(shredId: number): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) return;

		try {
			await chuck.removeShred(shredId);
		} catch {
			// Ignore errors
		}

		this.shreds = this.shreds.filter((shred) => shred.id !== shredId);
		this.updateStore();
	}

	async clearAll(): Promise<void> {
		const chuck = await this.ensureChuck();
		if (!chuck) throw new Error('chuck~ not initialized');

		try {
			chuck.clearChuckInstance();
			this.shreds = [];
			this.updateStore();
		} catch (error) {
			logger.error('chuck~ clear error:', error);
			throw error;
		}
	}

	getShreds(): ChuckShred[] {
		return [...this.shreds];
	}

	private updateStore() {
		this.shredsStore.set([...this.shreds]);
	}

	async ensureChuck(): Promise<Chuck | null> {
		if (this.ready) return this.chuck;

		try {
			await this.reloadChuck();
			this.ready = true;

			return this.chuck;
		} catch (error) {
			logger.error('failed to initialize chuck~:', error);
			return null;
		}
	}

	async reloadChuck() {
		const { Chuck } = await import('webchuck');

		if (this.chuck) {
			this.chuck.clearChuckInstance();
			this.chuck.clearGlobals();
		}

		this.chuck = await Chuck.init(
			[],
			this.audioContext,
			this.audioNode.channelCount,
			'./webchuck/'
		);
		this.chuck.connect(this.audioNode);

		// Redirect ChucK print to message system
		this.chuck.chuckPrint = (message: string) => {
			this.messageContext.send(message);
		};

		this.chuck.addEventListener('processorerror', (event) => {
			logger.error('chuck~ AudioWorkletProcessor error:', event);
		});

		// Connect any pending input connections
		for (const inputNode of this.pendingInputConnections) {
			inputNode.connect(this.chuck);
		}

		this.pendingInputConnections = [];

		logger.log('[chuck~] reloaded');
	}

	/**
	 * Handle incoming audio connections.
	 * Routes audio to the ChucK instance so it's accessible via `adc` in ChucK code.
	 */
	connectFrom(source: AudioNodeV2): void {
		if (!source.audioNode) return;

		// Connect the source to the ChucK instance (not our output gain node)
		// This makes the audio available via `adc` in ChucK code
		if (this.chuck) {
			source.audioNode.connect(this.chuck);
		} else {
			// ChucK not ready yet - queue the connection
			this.pendingInputConnections.push(source.audioNode);
		}
	}

	destroy(): void {
		if (this.chuck) {
			// Stop all event listeners
			for (const [event, callbackId] of this.eventListenerIds) {
				this.chuck.stopListeningForEvent(event, callbackId);
			}

			try {
				this.chuck.removeLastCode();
			} catch (error) {
				logger.error('failed to cleanup chuck~ during destroy:', error);
			}
		}

		this.audioNode.disconnect();
		this.shreds = [];
		this.chuck = null;
		this.ready = false;
		this.pendingInputConnections = [];
		this.eventListenerIds.clear();
		this.messageContext.destroy();
	}
}
