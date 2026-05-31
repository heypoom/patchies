import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { match } from 'ts-pattern';
import PyodideWorker from '../../workers/python/pyodideWorker?worker';

export type PyodideWorkerMessage = { id: string; nodeId: string } & (
  | { type: 'createInstance' }
  | { type: 'deleteInstance' }
  | { type: 'executeCode'; code: string }
  | { type: 'executePeppermintCode'; code: string; input: unknown }
);

export type PyodideWorkerResponse = { id?: string; nodeId: string } & (
  | { type: 'success' }
  | { type: 'error'; error: string }
  | { type: 'consoleOutput'; output: 'stdout' | 'stderr'; message: string | null }
  | { type: 'sendMessage'; data: unknown; options?: SendMessageOptions }
);

type PendingRequest = {
  resolve: () => void;
  reject: (error: Error) => void;
};

export class PyodideSystem {
  private static instance: PyodideSystem | null = null;

  eventBus = PatchiesEventBus.getInstance();
  private worker: Worker;
  private lastId = 1;
  private nodeInstances = new Set<string>();
  private pendingRequests = new Map<string, PendingRequest>();

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
      })
      .with({ type: 'success' }, (event) => {
        if (!event.id) return;

        const request = this.pendingRequests.get(event.id);
        if (!request) return;

        this.pendingRequests.delete(event.id);
        request.resolve();
      })
      .with({ type: 'error' }, (event) => {
        this.eventBus.dispatch({
          type: 'pyodideConsoleOutput',
          nodeId: event.nodeId,
          output: 'stderr',
          message: event.error,
          finished: true
        });

        if (!event.id) return;

        const request = this.pendingRequests.get(event.id);
        if (!request) return;

        this.pendingRequests.delete(event.id);
        request.reject(new Error(event.error));
      });
  };

  private send<T extends PyodideWorkerMessage['type']>(
    type: T,
    payload: Omit<Extract<PyodideWorkerMessage, { type: T }>, 'type' | 'id'>
  ): Promise<void> {
    const id = this.getId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({
        type,
        id,
        ...payload
      });
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

  async executePeppermintCode(nodeId: string, code: string, input: unknown) {
    if (!this.nodeInstances.has(nodeId)) {
      throw new Error(`No Pyodide instance found for node ${nodeId}`);
    }

    await this.send('executePeppermintCode', { nodeId, code, input });
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
