import type { Node } from '@xyflow/svelte';
import { createConnectionString } from './connection-string';
import {
  applyRepresentationFileWrite,
  buildObjectRepresentations,
  buildPatchRepresentation,
  type FileWriteResult,
  type RepresentationObject
} from './representation';

const protocolVersion = 'patchies.remote-control.v2';
const patchSyncDelay = 150;
const reconnectDelay = 500;

interface SessionCredentials {
  sessionId: string;
  secret: string;
}

interface PersistedSession extends SessionCredentials {
  patchRevision: number;
}

interface OperationRequest {
  operationId: string;
  browserGeneration: string;
  baseRevision: number;
  path: string;
  content: string;
}

interface ObjectChange {
  objectId: string;
  object: RepresentationObject | null;
}

interface CanonicalCommit {
  commitId: string;
  operationId?: string;
  browserGeneration: string;
  baseRevision: number;
  patchRevision: number;
  applied: boolean;
  changes: ObjectChange[];
}

interface SyncCoordinatorOptions {
  patchId: () => string;
  nodes: () => Node[];
  applyFileWrite: (write: Extract<FileWriteResult, { status: 'applied' }>) => void;
  onEnabledChange?: (enabled: boolean) => void;
  instanceURL?: string;
}

class RemoteControlRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string
  ) {
    super(
      code
        ? `Remote control request failed: ${status} (${code})`
        : `Remote control request failed: ${status}`
    );
  }
}

export class RemoteControlSyncCoordinator {
  private abortController: AbortController | null = null;
  private browserGeneration = '';
  private credentials: SessionCredentials | null = null;
  private eventCursor = 0;
  private objectSignatures = new Map<string, string>();
  private patchRevision = 0;
  private pendingNodes: Node[] | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private work = Promise.resolve();

  constructor(private readonly options: SyncCoordinatorOptions) {}

  get isEnabled(): boolean {
    return this.credentials !== null;
  }

  get mountCommand(): string | null {
    if (!this.credentials) return null;

    const token = createConnectionString({
      instanceURL: this.instanceURL,
      sessionID: this.credentials.sessionId,
      secret: this.credentials.secret
    });

    return `patchies mount --token ${token} --path <new-folder-path>`;
  }

  async enable(): Promise<void> {
    if (this.credentials) return;

    const persisted = this.readPersistedSession();
    if (persisted) {
      await this.reclaim(persisted);
      return;
    }

    this.browserGeneration = crypto.randomUUID();
    this.credentials = await this.request<SessionCredentials>('/api/remote-control/sessions', {
      method: 'POST',
      body: {
        protocolVersion,
        patchId: this.options.patchId(),
        browserGeneration: this.browserGeneration
      }
    });

    await this.publishSnapshot();
    this.resetObjectBaseline();
    this.persistSession();
    this.startEventStream();
    this.options.onEnabledChange?.(true);
  }

  async restore(): Promise<boolean> {
    if (this.credentials) return false;

    const persisted = this.readPersistedSession();
    if (!persisted) return false;

    await this.reclaim(persisted);

    return true;
  }

  disable(): void {
    const credentials = this.credentials;
    if (credentials) {
      void this.request(`/api/remote-control/sessions/${credentials.sessionId}`, {
        method: 'DELETE'
      }).catch((error: unknown) => console.error('Failed to revoke Remote Control session', error));
    }

    this.clearLocalSession();
  }

  dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.pendingNodes = null;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
  }

  notifyPatchChanged(nodes = this.options.nodes()): void {
    if (!this.credentials) return;
    this.pendingNodes = nodes;
    if (this.syncTimer) clearTimeout(this.syncTimer);

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.enqueue(() => this.publishPatchChanges());
    }, patchSyncDelay);
  }

  private get instanceURL(): string {
    return this.options.instanceURL ?? window.location.origin;
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const result = this.work.then(task);
    this.work = result.catch((error: unknown) =>
      console.error('Remote Control synchronization failed', error)
    );

    return result;
  }

  private clearLocalSession(): void {
    this.dispose();
    this.credentials = null;
    this.eventCursor = 0;
    this.patchRevision = 0;
    this.objectSignatures.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(this.storageKey);
    this.options.onEnabledChange?.(false);
  }

  private async publishSnapshot(): Promise<void> {
    await this.request(
      `/api/remote-control/sessions/${this.requireCredentials().sessionId}/snapshot`,
      {
        method: 'POST',
        body: {
          browserGeneration: this.browserGeneration,
          patchRevision: this.patchRevision,
          representation: buildPatchRepresentation(this.options.patchId(), this.options.nodes())
        }
      }
    );
  }

  private startEventStream(): void {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    void this.runEventStream(controller.signal);
  }

  private async runEventStream(signal: AbortSignal): Promise<void> {
    while (!signal.aborted && this.credentials) {
      try {
        await this.consumeEventStream(signal);
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof RemoteControlRequestError) {
          if (error.code === 'session_not_found') {
            this.clearLocalSession();
            return;
          }
          if (error.code === 'replay_unavailable') {
            this.eventCursor = 0;
            continue;
          }
        }

        console.error('Remote control browser stream stopped; reconnecting', error);
      }

      await wait(reconnectDelay, signal);
    }
  }

  private async consumeEventStream(signal: AbortSignal): Promise<void> {
    const headers = new Headers(this.headers());
    if (this.eventCursor > 0) headers.set('Last-Event-ID', String(this.eventCursor));

    const response = await fetch(
      `${this.instanceURL}/api/remote-control/sessions/${this.requireCredentials().sessionId}/browser/events`,
      { headers, signal }
    );
    if (!response.ok || !response.body) throw await this.responseError(response);

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;

      pending += value;
      const events = pending.split('\n\n');
      pending = events.pop() ?? '';
      for (const event of events) await this.handleSSEEvent(event);
    }
  }

  private async handleSSEEvent(event: string): Promise<void> {
    const id = Number(event.match(/^id: (.+)$/m)?.[1] ?? 0);
    const type = event.match(/^event: (.+)$/m)?.[1];
    const data = event.match(/^data: (.+)$/m)?.[1];

    if (type === 'client.attached') {
      await this.enqueue(async () => {
        await this.publishSnapshot();
        this.resetObjectBaseline();
      });
    } else if (type === 'operation.submitted' && data) {
      const operation = JSON.parse(data) as OperationRequest;
      await this.enqueue(() => this.resolveOperation(operation));
    }

    if (Number.isSafeInteger(id) && id > this.eventCursor) this.eventCursor = id;
  }

  private async resolveOperation(operation: OperationRequest): Promise<void> {
    if (operation.browserGeneration !== this.browserGeneration) return;

    const write = applyRepresentationFileWrite(
      this.options.nodes(),
      operation.path,
      operation.content
    );
    if (write.status === 'applied') this.options.applyFileWrite(write);

    const object =
      write.status === 'applied'
        ? buildObjectRepresentations(this.options.nodes()).find(
            (candidate) => candidate.id === write.nodeId
          )
        : undefined;
    if (write.status === 'applied' && !object) {
      throw new Error(`Remote Control could not represent updated object ${write.nodeId}`);
    }

    await this.publishCommit({
      commitId: crypto.randomUUID(),
      operationId: operation.operationId,
      browserGeneration: this.browserGeneration,
      baseRevision: this.patchRevision,
      applied: write.status === 'applied',
      changes: object ? [{ objectId: object.id, object }] : []
    });
  }

  private async publishPatchChanges(): Promise<void> {
    if (!this.credentials) return;

    const nodes = this.pendingNodes ?? this.options.nodes();
    this.pendingNodes = null;
    const nextObjects = new Map(
      buildObjectRepresentations(nodes).map((object) => [object.id, JSON.stringify(object)])
    );
    const changedIDs = new Set<string>();
    for (const [objectID, signature] of nextObjects) {
      if (this.objectSignatures.get(objectID) !== signature) changedIDs.add(objectID);
    }
    for (const objectID of this.objectSignatures.keys()) {
      if (!nextObjects.has(objectID)) changedIDs.add(objectID);
    }
    if (changedIDs.size === 0) return;

    const changes = [...changedIDs].sort().map((objectId) => {
      const signature = nextObjects.get(objectId);

      return {
        objectId,
        object: signature ? (JSON.parse(signature) as RepresentationObject) : null
      };
    });
    await this.publishCommit({
      commitId: crypto.randomUUID(),
      browserGeneration: this.browserGeneration,
      baseRevision: this.patchRevision,
      applied: true,
      changes
    });
  }

  private async publishCommit(
    request: Omit<CanonicalCommit, 'patchRevision'>
  ): Promise<CanonicalCommit> {
    const credentials = this.requireCredentials();
    let commit: CanonicalCommit;
    while (true) {
      try {
        commit = await this.request<CanonicalCommit>(
          `/api/remote-control/sessions/${credentials.sessionId}/commits`,
          { method: 'POST', body: request }
        );
        break;
      } catch (error) {
        if (
          this.credentials !== credentials ||
          (error instanceof RemoteControlRequestError && error.status < 500)
        ) {
          throw error;
        }

        await wait(reconnectDelay);
      }
    }

    this.patchRevision = commit.patchRevision;
    for (const change of commit.changes) {
      if (change.object) this.objectSignatures.set(change.objectId, JSON.stringify(change.object));
      else this.objectSignatures.delete(change.objectId);
    }
    this.persistSession();

    return commit;
  }

  private async request<T = void>(
    path: string,
    init: { method: string; body?: unknown }
  ): Promise<T> {
    const response = await fetch(`${this.instanceURL}${path}`, {
      method: init.method,
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
    if (!response.ok) {
      const error = await this.responseError(response);
      if (error.code === 'session_not_found' && this.credentials) this.clearLocalSession();

      throw error;
    }
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  private async responseError(response: Response): Promise<RemoteControlRequestError> {
    try {
      const body = (await response.json()) as { code?: string };

      return new RemoteControlRequestError(response.status, body.code);
    } catch {
      return new RemoteControlRequestError(response.status);
    }
  }

  private headers(): HeadersInit {
    return this.credentials ? { Authorization: `Bearer ${this.credentials.secret}` } : {};
  }

  private requireCredentials(): SessionCredentials {
    if (!this.credentials) throw new Error('Remote control is disabled');

    return this.credentials;
  }

  private get storageKey(): string {
    return `patchies.remote-control.${this.options.patchId()}`;
  }

  private async reclaim(persisted: PersistedSession): Promise<void> {
    this.credentials = { sessionId: persisted.sessionId, secret: persisted.secret };
    this.patchRevision = persisted.patchRevision;
    this.browserGeneration = crypto.randomUUID();
    this.eventCursor = 0;

    try {
      const snapshot = await this.request<{ patchRevision: number }>(
        `/api/remote-control/sessions/${this.credentials.sessionId}/reclaim`,
        {
          method: 'POST',
          body: {
            patchId: this.options.patchId(),
            browserGeneration: this.browserGeneration,
            patchRevision: this.patchRevision
          }
        }
      );
      this.patchRevision = snapshot.patchRevision;

      await this.publishSnapshot();
      this.resetObjectBaseline();
      this.persistSession();
      this.startEventStream();
      this.options.onEnabledChange?.(true);
    } catch (error) {
      this.clearLocalSession();
      throw error;
    }
  }

  private readPersistedSession(): PersistedSession | null {
    if (typeof sessionStorage === 'undefined') return null;

    const value = sessionStorage.getItem(this.storageKey);
    if (!value) return null;

    try {
      const parsed = JSON.parse(value) as PersistedSession;
      if (!parsed.sessionId || !parsed.secret || !Number.isInteger(parsed.patchRevision)) {
        return null;
      }

      return parsed;
    } catch {
      sessionStorage.removeItem(this.storageKey);

      return null;
    }
  }

  private persistSession(): void {
    if (typeof sessionStorage === 'undefined') return;

    const credentials = this.requireCredentials();
    sessionStorage.setItem(
      this.storageKey,
      JSON.stringify({
        ...credentials,
        patchRevision: this.patchRevision
      } satisfies PersistedSession)
    );
  }

  private resetObjectBaseline(): void {
    this.objectSignatures = new Map(
      buildObjectRepresentations(this.options.nodes()).map((object) => [
        object.id,
        JSON.stringify(object)
      ])
    );
  }
}

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const finish = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    signal?.addEventListener('abort', finish, { once: true });
  });
