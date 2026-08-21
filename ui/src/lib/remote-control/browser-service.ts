import type { Node } from '@xyflow/svelte';
import { createConnectionString } from './connection-string';
import {
  applyRepresentationFileWrite,
  buildObjectRepresentations,
  buildPatchRepresentation,
  type RepresentationObject,
  type FileWriteResult
} from './representation';

const protocolVersion = 'patchies.remote-control.v1';

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
  patchRevision: number;
  path: string;
  content: string;
}

interface BrowserServiceOptions {
  patchId: () => string;
  nodes: () => Node[];
  applyFileWrite: (write: Extract<FileWriteResult, { status: 'applied' }>) => void;
  onEnabledChange?: (enabled: boolean) => void;
  instanceURL?: string;
}

export class BrowserRemoteControlService {
  private abortController: AbortController | null = null;
  private browserGeneration = '';
  private credentials: SessionCredentials | null = null;
  private isApplyingRemoteOperation = false;
  private objectSignatures = new Map<string, string>();
  private patchRevision = 0;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: BrowserServiceOptions) {}

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

    const credentials = await this.request<SessionCredentials>('/api/remote-control/sessions', {
      method: 'POST',
      body: {
        protocolVersion,
        patchId: this.options.patchId(),
        browserGeneration: this.browserGeneration
      }
    });
    this.credentials = credentials;

    await this.publishSnapshot(this.patchRevision);
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

  private clearLocalSession(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.credentials = null;
    this.patchRevision = 0;
    this.objectSignatures.clear();
    if (this.syncTimer) clearTimeout(this.syncTimer);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(this.storageKey);
    this.options.onEnabledChange?.(false);
  }

  async syncCurrentPatch(): Promise<void> {
    if (!this.credentials || this.isApplyingRemoteOperation) return;

    await this.publishObjectChanges(true);
  }

  scheduleCurrentPatchSync(): void {
    if (!this.credentials || this.isApplyingRemoteOperation) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.syncCurrentPatch().catch((error: unknown) =>
        console.error('Failed to synchronize Remote Control objects', error)
      );
    }, 150);
  }

  private get instanceURL(): string {
    return this.options.instanceURL ?? window.location.origin;
  }

  private async publishSnapshot(patchRevision: number): Promise<void> {
    await this.request(
      `/api/remote-control/sessions/${this.requireCredentials().sessionId}/snapshot`,
      {
        method: 'POST',
        body: {
          browserGeneration: this.browserGeneration,
          patchRevision,
          representation: buildPatchRepresentation(this.options.patchId(), this.options.nodes())
        }
      }
    );
  }

  private startEventStream(): void {
    this.abortController?.abort();
    this.abortController = new AbortController();
    void this.consumeEventStream(this.abortController.signal).catch((error: unknown) => {
      if (!this.abortController?.signal.aborted)
        console.error('Remote control browser stream stopped', error);
    });
  }

  private async consumeEventStream(signal: AbortSignal): Promise<void> {
    const response = await fetch(
      `${this.instanceURL}/api/remote-control/sessions/${this.requireCredentials().sessionId}/browser/events`,
      { headers: this.headers(), signal }
    );
    if (response.status === 404) {
      this.clearLocalSession();
      throw new Error('Remote Control session ended because the server restarted or revoked it');
    }
    if (!response.ok || !response.body)
      throw new Error(`Remote control browser stream failed: ${response.status}`);

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (!signal.aborted) this.clearLocalSession();
        return;
      }

      pending += value;
      const events = pending.split('\n\n');
      pending = events.pop() ?? '';
      for (const event of events) await this.handleSSEEvent(event);
    }
  }

  private async handleSSEEvent(event: string): Promise<void> {
    const type = event.match(/^event: (.+)$/m)?.[1];
    const data = event.match(/^data: (.+)$/m)?.[1];
    if (type === 'client.attached') {
      await this.publishSnapshot(this.patchRevision);
      this.resetObjectBaseline();
      return;
    }
    if (type !== 'operation.submitted' || !data) return;

    const operation = JSON.parse(data) as OperationRequest;
    const write = applyRepresentationFileWrite(
      this.options.nodes(),
      operation.path,
      operation.content
    );
    this.isApplyingRemoteOperation = true;
    try {
      if (write.status === 'applied') this.options.applyFileWrite(write);

      const applied = write.status === 'applied';
      const patchRevision = applied ? this.patchRevision + 1 : this.patchRevision;
      const result = await this.request(
        `/api/remote-control/sessions/${this.requireCredentials().sessionId}/operations/${operation.operationId}/ack`,
        {
          method: 'POST',
          body: { browserGeneration: this.browserGeneration, patchRevision, applied }
        }
      );

      if (applied) {
        this.patchRevision = patchRevision;
        await this.publishObjectChanges(false);
        this.persistSession();
      }

      return result;
    } finally {
      this.isApplyingRemoteOperation = false;
    }
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
      const error = await this.readRequestError(response);
      if (error.code === 'session_not_found' && this.credentials) this.clearLocalSession();

      throw new Error(
        error.code
          ? `Remote control request failed: ${response.status} (${error.code})`
          : `Remote control request failed: ${response.status}`
      );
    }
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  private async readRequestError(response: Response): Promise<{ code?: string }> {
    try {
      return (await response.json()) as { code?: string };
    } catch {
      return {};
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

      await this.publishSnapshot(this.patchRevision);
      this.resetObjectBaseline();
      this.persistSession();
      this.startEventStream();
      this.options.onEnabledChange?.(true);
    } catch (error) {
      this.disable();
      throw error;
    }
  }

  private readPersistedSession(): PersistedSession | null {
    if (typeof sessionStorage === 'undefined') return null;

    const value = sessionStorage.getItem(this.storageKey);
    if (!value) return null;

    try {
      const parsed = JSON.parse(value) as PersistedSession;
      if (!parsed.sessionId || !parsed.secret || !Number.isInteger(parsed.patchRevision))
        return null;

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

  private async publishObjectChanges(advanceRevision: boolean): Promise<void> {
    const nextObjects = new Map(
      buildObjectRepresentations(this.options.nodes()).map((object) => [
        object.id,
        JSON.stringify(object)
      ])
    );
    const changedIDs = new Set<string>();
    for (const [objectID, signature] of nextObjects) {
      if (this.objectSignatures.get(objectID) !== signature) changedIDs.add(objectID);
    }
    for (const objectID of this.objectSignatures.keys()) {
      if (!nextObjects.has(objectID)) changedIDs.add(objectID);
    }

    for (const objectID of [...changedIDs].sort()) {
      const signature = nextObjects.get(objectID);
      const patchRevision = advanceRevision ? this.patchRevision + 1 : this.patchRevision;
      console.info('Remote Control object update', {
        objectID,
        kind: signature ? (this.objectSignatures.has(objectID) ? 'updated' : 'added') : 'removed',
        patchRevision
      });
      await this.publishObject(objectID, signature ? JSON.parse(signature) : null, patchRevision);
      this.patchRevision = patchRevision;
      if (signature) this.objectSignatures.set(objectID, signature);
      else this.objectSignatures.delete(objectID);
    }
    if (changedIDs.size > 0) this.persistSession();
  }

  private async publishObject(
    objectID: string,
    object: RepresentationObject | null,
    patchRevision: number
  ): Promise<void> {
    await this.request(
      `/api/remote-control/sessions/${this.requireCredentials().sessionId}/objects/${objectID}`,
      {
        method: 'POST',
        body: { browserGeneration: this.browserGeneration, patchRevision, object }
      }
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
