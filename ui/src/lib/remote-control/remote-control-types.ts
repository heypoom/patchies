import type { RepresentationObject } from './representation';

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

export interface ObjectChange {
  objectId: string;
  object: RepresentationObject | null;
}

export interface CanonicalCommit {
  commitId: string;
  operationId?: string;
  browserGeneration: string;
  baseRevision: number;
  patchRevision: number;
  applied: boolean;
  changes: ObjectChange[];
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
