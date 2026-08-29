import type { Node } from '@xyflow/svelte';
import { BrowserEventStream, type BrowserEvent } from './browser-event-stream';
import { createConnectionString } from './connection-string';
import { RepresentationChangeTracker } from './representation-change-tracker';
import { RemoteControlRelayClient } from './relay-client';
import {
  RemoteControlRequestError,
  type CanonicalCommit,
  type OperationRequest,
  type PersistedSession,
  type SessionCredentials
} from './remote-control-types';
import {
  applyRepresentationFileWrite,
  buildObjectRepresentations,
  buildPatchRepresentation,
  type FileWriteResult
} from './representation';

const protocolVersion = 'patchies.remote-control.v2';
const patchSyncDelay = 150;
const reconnectDelay = 500;
const maxCommitAttempts = 3;

interface SyncCoordinatorOptions {
  patchId: () => string;
  nodes: () => Node[];
  applyFileWrite: (write: Extract<FileWriteResult, { status: 'applied' }>) => void;
  onEnabledChange?: (enabled: boolean) => void;
  instanceURL?: string;
}

export class RemoteControlSyncCoordinator {
  private browserGeneration = '';
  private readonly changeTracker = new RepresentationChangeTracker();
  private credentials: SessionCredentials | null = null;
  private readonly eventStream: BrowserEventStream;
  private patchRevision = 0;
  private pendingNodes: Node[] | null = null;
  private readonly relay: RemoteControlRelayClient;
  private sessionPatchId: string | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private transitioningPatchId: string | null = null;
  private work = Promise.resolve();

  constructor(private readonly options: SyncCoordinatorOptions) {
    this.relay = new RemoteControlRelayClient(this.instanceURL, () => this.credentials);

    this.eventStream = new BrowserEventStream({
      open: (afterEventID, signal) =>
        this.relay.openBrowserEvents(this.requireCredentials().sessionId, afterEventID, signal),
      onEvent: (event) => this.handleBrowserEvent(event),
      onSessionNotFound: () => this.clearLocalSession()
    });
  }

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

    const patchId = this.options.patchId();

    this.browserGeneration = crypto.randomUUID();

    this.credentials = await this.request<SessionCredentials>('/api/remote-control/sessions', {
      method: 'POST',
      body: {
        protocolVersion,
        patchId,
        browserGeneration: this.browserGeneration
      }
    });
    this.sessionPatchId = patchId;

    try {
      await this.publishSnapshot();

      this.changeTracker.reset(this.options.nodes());
      this.persistSession();
      this.eventStream.start();
      this.options.onEnabledChange?.(true);
    } catch (error) {
      this.clearLocalSession();
      throw error;
    }
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
      this.request(`/api/remote-control/sessions/${credentials.sessionId}`, {
        method: 'DELETE'
      }).catch((error: unknown) => console.error('Failed to revoke Remote Control session', error));
    }

    this.clearLocalSession();
  }

  dispose(): void {
    this.eventStream.stop();
    this.pendingNodes = null;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = null;
  }

  notifyPatchChanged(nodes = this.options.nodes(), patchId = this.options.patchId()): void {
    if (!this.credentials) return;

    if (patchId !== this.sessionPatchId) {
      this.schedulePatchTransition(patchId, nodes);
      return;
    }

    this.pendingNodes = nodes;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.enqueue(() => this.publishPatchChanges());
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
    const sessionPatchId = this.sessionPatchId;

    this.dispose();
    this.credentials = null;
    this.patchRevision = 0;
    this.sessionPatchId = null;
    this.changeTracker.clear();

    if (typeof sessionStorage !== 'undefined' && sessionPatchId) {
      sessionStorage.removeItem(this.storageKey(sessionPatchId));
    }

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
          representation: buildPatchRepresentation(
            this.requireSessionPatchId(),
            this.options.nodes()
          )
        }
      }
    );
  }

  private async handleBrowserEvent(event: BrowserEvent): Promise<void> {
    if (event.type === 'client.attached') {
      await this.enqueue(async () => {
        await this.publishSnapshot();

        this.changeTracker.reset(this.options.nodes());
      });
    } else if (event.type === 'operation.submitted' && event.data) {
      let operation: OperationRequest;

      try {
        operation = JSON.parse(event.data) as OperationRequest;
      } catch (error) {
        console.error('Remote Control received an invalid operation', error);
        return;
      }

      try {
        await this.enqueue(() => this.resolveOperation(operation));
      } catch (error) {
        console.error(`Remote Control could not resolve operation ${operation.operationId}`, error);
      }
    }
  }

  private async resolveOperation(operation: OperationRequest): Promise<void> {
    if (operation.browserGeneration !== this.browserGeneration) return;

    const write = applyRepresentationFileWrite(
      this.options.nodes(),
      operation.path,
      operation.content
    );

    if (write.status === 'applied') {
      this.options.applyFileWrite(write);
    }

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

    const changes = this.changeTracker.changes(nodes);
    if (changes.length === 0) return;

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
    for (let attempt = 0; attempt < maxCommitAttempts; attempt++) {
      try {
        const commit = await this.request<CanonicalCommit>(
          `/api/remote-control/sessions/${credentials.sessionId}/commits`,
          { method: 'POST', body: request }
        );

        this.patchRevision = commit.patchRevision;
        this.changeTracker.accept(commit.changes);
        this.persistSession();

        return commit;
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

    throw new Error('Remote Control commit retry limit reached');
  }

  private async request<T = void>(
    path: string,
    init: { method: string; body?: unknown }
  ): Promise<T> {
    try {
      return await this.relay.request<T>(path, init);
    } catch (error) {
      if (error instanceof RemoteControlRequestError && error.code === 'session_not_found') {
        this.clearLocalSession();
      }

      throw error;
    }
  }

  private requireCredentials(): SessionCredentials {
    if (!this.credentials) throw new Error('Remote control is disabled');

    return this.credentials;
  }

  private requireSessionPatchId(): string {
    if (!this.sessionPatchId) throw new Error('Remote control has no active patch');

    return this.sessionPatchId;
  }

  private storageKey(patchId: string): string {
    return `patchies.remote-control.${patchId}`;
  }

  private async reclaim(persisted: PersistedSession): Promise<void> {
    const patchId = this.options.patchId();

    this.credentials = { sessionId: persisted.sessionId, secret: persisted.secret };
    this.patchRevision = persisted.patchRevision;
    this.browserGeneration = crypto.randomUUID();
    this.sessionPatchId = patchId;

    try {
      const snapshot = await this.request<{ patchRevision: number }>(
        `/api/remote-control/sessions/${this.credentials.sessionId}/reclaim`,
        {
          method: 'POST',
          body: {
            patchId,
            browserGeneration: this.browserGeneration,
            patchRevision: this.patchRevision
          }
        }
      );

      this.patchRevision = snapshot.patchRevision;

      await this.publishSnapshot();

      this.changeTracker.reset(this.options.nodes());
      this.persistSession();
      this.eventStream.start();
      this.options.onEnabledChange?.(true);
    } catch (error) {
      this.clearLocalSession();
      throw error;
    }
  }

  private readPersistedSession(): PersistedSession | null {
    if (typeof sessionStorage === 'undefined') return null;

    const patchId = this.options.patchId();
    const value = sessionStorage.getItem(this.storageKey(patchId));
    if (!value) return null;

    try {
      const parsed = JSON.parse(value) as PersistedSession;

      if (!parsed.sessionId || !parsed.secret || !Number.isInteger(parsed.patchRevision)) {
        return null;
      }

      return parsed;
    } catch {
      sessionStorage.removeItem(this.storageKey(patchId));

      return null;
    }
  }

  private persistSession(): void {
    if (typeof sessionStorage === 'undefined') return;

    const credentials = this.requireCredentials();

    sessionStorage.setItem(
      this.storageKey(this.requireSessionPatchId()),
      JSON.stringify({
        ...credentials,
        patchRevision: this.patchRevision
      } satisfies PersistedSession)
    );
  }

  private schedulePatchTransition(patchId: string, nodes: Node[]): void {
    this.pendingNodes = nodes;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.transitioningPatchId === patchId) return;

    this.transitioningPatchId = patchId;
    this.enqueue(async () => {
      try {
        if (this.sessionPatchId === patchId) return;

        await this.transitionToCurrentPatch();
      } finally {
        if (this.transitioningPatchId === patchId) {
          this.transitioningPatchId = null;
        }
      }
    });
  }

  private async transitionToCurrentPatch(): Promise<void> {
    const credentials = this.credentials;
    if (!credentials) return;

    this.eventStream.stop();

    try {
      await this.relay.request(`/api/remote-control/sessions/${credentials.sessionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to revoke Remote Control session for previous patch', error);
    }

    this.clearLocalSession();
    await this.enable();
  }
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
