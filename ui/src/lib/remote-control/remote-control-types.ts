import type { MountEntry } from '../vfs/VfsMountTree';

export interface SessionCredentials {
  sessionId: string;
  secret: string;
}

export interface PersistedSession extends SessionCredentials {
  patchRevision: number;
}

export interface OperationRequest {
  operationId: string;
  browserGeneration: string;
  baseRevision: number;
  path: string;
  content: string;
}

export interface EntryChange {
  path: string;
  entry: MountEntry | null;
}

export interface CanonicalCommit {
  error?: string;
  commitId: string;
  operationId?: string;
  browserGeneration: string;
  baseRevision: number;
  patchRevision: number;
  applied: boolean;
  changes: EntryChange[];
}

export class RemoteControlRequestError extends Error {
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
