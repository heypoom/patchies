import type { PyodideWorkerMessage, PyodideWorkerResponse } from './PyodideSystem';

export function createPyodideWorkerSuccessResponse(
  message: PyodideWorkerMessage
): PyodideWorkerResponse {
  return {
    type: 'success',
    id: message.id,
    nodeId: message.nodeId
  };
}

export function createPyodideWorkerErrorResponse(
  message: PyodideWorkerMessage,
  error: unknown
): PyodideWorkerResponse {
  return {
    type: 'error',
    id: message.id,
    nodeId: message.nodeId,
    error: error instanceof Error ? error.message : String(error)
  };
}
