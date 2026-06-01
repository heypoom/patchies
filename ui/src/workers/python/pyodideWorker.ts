import { match } from 'ts-pattern';
import type { PyodideAPI } from 'pyodide';
import type { PyodideWorkerMessage } from '$lib/python/PyodideSystem';
import {
  createPyodideWorkerErrorResponse,
  createPyodideWorkerSuccessResponse
} from '$lib/python/pyodide-messages';
import { formatPeppermintError } from '$lib/peppermint/errors';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { PeppermintPyodideRuntime } from './peppermint';

/** Name of the Python package to interact with patchies */
const PATCHIES_PACKAGE = 'patch';

// Store pyodide instances by node ID
const pyodideByNode = new Map<string, PyodideAPI>();
const peppermintRuntime = new PeppermintPyodideRuntime();

self.onmessage = async (event: MessageEvent<PyodideWorkerMessage>) => {
  try {
    await match(event.data)
      .with({ type: 'createInstance' }, (data) => handleCreateInstance(data))
      .with({ type: 'deleteInstance' }, (data) => handleDeleteInstance(data))
      .with({ type: 'executeCode' }, (data) => handleExecuteCode(data))
      .with({ type: 'executePeppermintCode' }, (data) => handleExecutePeppermintCode(data))
      .exhaustive();

    self.postMessage(createPyodideWorkerSuccessResponse(event.data));
  } catch (error) {
    self.postMessage(createPyodideWorkerErrorResponse(event.data, error));
  }
};

async function handleCreateInstance(data: { nodeId: string }) {
  const { nodeId } = data;

  if (pyodideByNode.has(nodeId)) {
    return { success: true };
  }

  const { loadPyodide, version } = await import('pyodide');

  /** Where to load Pyodide packages from? */
  const PYODIDE_PACKAGE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;

  const pyodide = await loadPyodide({
    indexURL: '/assets',
    packageBaseUrl: PYODIDE_PACKAGE_BASE_URL,
    env: {
      PATCHIES_NODE_ID: nodeId
    },
    stdout: (message: string) => {
      self.postMessage({
        type: 'consoleOutput',
        nodeId,
        output: 'stdout',
        message
      });
    },
    stderr: (message: string) => {
      self.postMessage({
        type: 'consoleOutput',
        nodeId,
        output: 'stderr',
        message
      });
    }
  });

  const canvas = new OffscreenCanvas(200, 200);
  pyodide.canvas.setCanvas2D(canvas as unknown as HTMLCanvasElement);

  const patchiesModule = {
    send(data: unknown, options?: SendMessageOptions) {
      self.postMessage({
        type: 'sendMessage',
        data,
        options,
        nodeId
      });
    }
  };

  pyodide.registerJsModule(PATCHIES_PACKAGE, patchiesModule);

  pyodideByNode.set(nodeId, pyodide);

  return { success: true };
}

async function handleDeleteInstance(data: { nodeId: string }) {
  const { nodeId } = data;
  const pyodide = pyodideByNode.get(nodeId);

  if (pyodide) {
    pyodide.unregisterJsModule(PATCHIES_PACKAGE);
    pyodideByNode.delete(nodeId);
    peppermintRuntime.delete(nodeId);
  }

  return { success: true };
}

async function handleExecuteCode(data: { nodeId: string; code: string }) {
  const { nodeId, code } = data;
  const pyodide = pyodideByNode.get(nodeId);

  if (!pyodide) {
    throw new Error(`No Pyodide instance found for node ${nodeId}`);
  }

  await pyodide.loadPackagesFromImports(code, {
    checkIntegrity: false,
    messageCallback: () => {},
    errorCallback: (errorMessage) => {
      self.postMessage({
        type: 'consoleOutput',
        nodeId,
        output: 'stderr',
        message: `Package loading error: ${errorMessage}`
      });
    }
  });

  try {
    const result = await pyodide.runPythonAsync(code);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      output: 'stdout',
      message: result === undefined ? null : String(result),
      finished: true
    });
  } catch (error) {
    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      output: 'stderr',
      message: String(error),
      finished: true
    });
  }
}

async function handleExecutePeppermintCode(data: { nodeId: string; code: string; input: unknown }) {
  const { nodeId, code, input } = data;
  const pyodide = pyodideByNode.get(nodeId);

  if (!pyodide) {
    throw new Error(`No Pyodide instance found for node ${nodeId}`);
  }

  try {
    const result = await peppermintRuntime.execute(pyodide, nodeId, code, input);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      output: 'stdout',
      message: result === undefined || result === null ? null : String(result),
      finished: true
    });
  } catch (error) {
    const formatted = formatPeppermintError(String(error), code);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      output: 'stderr',
      message: formatted.message,
      lineErrors: formatted.lineErrors,
      finished: true
    });
  }
}

console.log('[pyodide worker] initialized');
