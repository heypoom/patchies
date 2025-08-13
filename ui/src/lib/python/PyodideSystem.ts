import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { match } from 'ts-pattern';
import PyodideWorker from '../../workers/python/pyodideWorker?worker';

export type PyodideWorkerMessage = { id: string; nodeId: string } & (
	| { type: 'createInstance' }
	| { type: 'deleteInstance' }
	| { type: 'executeCode'; code: string }
);

export type PyodideWorkerResponse = { id?: string; nodeId: string } & (
	| { type: 'success' }
	| { type: 'error'; error: string }
	| { type: 'consoleOutput'; output: 'stdout' | 'stderr'; message: string }
	| { type: 'sendMessage'; data: unknown; options?: SendMessageOptions }
);

export class PyodideSystem {
	private static instance: PyodideSystem | null = null;

	eventBus = PatchiesEventBus.getInstance();
	private worker: Worker;
	private lastId = 1;
	private nodeInstances = new Set<string>();

	constructor() {
		this.worker = new PyodideWorker();
		this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
	}

	/** Routes the events to the Svelte component via an event bus. */
	private handleWorkerMessage = ({ data }: MessageEvent<PyodideWorkerResponse>) => {
		match(data)
			.with({ type: 'consoleOutput' }, (event) => {
				this.eventBus.dispatch({ ...event, type: 'pyodideConsoleOutput' });
			})
			.with({ type: 'sendMessage' }, (event) => {
				this.eventBus.dispatch({ ...event, type: 'pyodideSendMessage' });
			});
	};

	private send<T extends PyodideWorkerMessage['type']>(
		type: T,
		payload: Omit<Extract<PyodideWorkerMessage, { type: T }>, 'type' | 'id'>
	) {
		const id = this.getId();

		this.worker.postMessage({
			type,
			id,
			...payload
		});
	}

	private getId(): string {
		return String(this.lastId++);
	}

	has(nodeId: string): boolean {
		return this.nodeInstances.has(nodeId);
	}

	async delete(nodeId: string): Promise<void> {
		if (!this.nodeInstances.has(nodeId)) return;

		await this.send('deleteInstance', { nodeId });
		this.nodeInstances.delete(nodeId);
	}

	async create(nodeId: string): Promise<void> {
		if (this.nodeInstances.has(nodeId)) {
			return;
		}

		await this.send('createInstance', { nodeId });

		this.nodeInstances.add(nodeId);
	}

	async executeCode(nodeId: string, code: string) {
		if (!this.nodeInstances.has(nodeId)) {
			throw new Error(`No Pyodide instance found for node ${nodeId}`);
		}

		await this.send('executeCode', { nodeId, code });
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new PyodideSystem();
		}

		// @ts-expect-error -- expose globally for debugging
		window.pyodide = this.instance;

		return this.instance;
	}
}
