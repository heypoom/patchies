import { describe, expect, it } from 'vitest';
import {
  createPyodideWorkerErrorResponse,
  createPyodideWorkerSuccessResponse
} from './pyodide-messages';

describe('createPyodideWorkerErrorResponse', () => {
  it('preserves the node id so node-local consoles receive worker errors', () => {
    const response = createPyodideWorkerErrorResponse(
      {
        type: 'executePeppermintCode',
        id: '7',
        nodeId: 'peppermint-7',
        code: 'input() |> send',
        input: null
      },
      new Error('No Pyodide instance found for node peppermint-7')
    );

    expect(response).toEqual({
      type: 'error',
      id: '7',
      nodeId: 'peppermint-7',
      error: 'No Pyodide instance found for node peppermint-7'
    });
  });
});

describe('createPyodideWorkerSuccessResponse', () => {
  it('does not include handler results that may be non-cloneable', () => {
    const response = createPyodideWorkerSuccessResponse({
      type: 'executePeppermintCode',
      id: '8',
      nodeId: 'peppermint-8',
      code: 'input() |> send',
      input: null
    });

    expect(response).toEqual({
      type: 'success',
      id: '8',
      nodeId: 'peppermint-8'
    });

    expect('result' in response).toBe(false);
  });
});
