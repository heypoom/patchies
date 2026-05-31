import { match } from 'ts-pattern';
import type { PyodideAPI } from 'pyodide';
import type { PyodideWorkerMessage } from '$lib/python/PyodideSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';

/** Name of the Python package to interact with patchies */
const PATCHIES_PACKAGE = 'patch';

// Store pyodide instances by node ID
const pyodideByNode = new Map<string, PyodideAPI>();
const peppermintReadyByNode = new Set<string>();

self.onmessage = async (event: MessageEvent<PyodideWorkerMessage>) => {
  const { id } = event.data;

  try {
    const result = await match(event.data)
      .with({ type: 'createInstance' }, (data) => handleCreateInstance(data))
      .with({ type: 'deleteInstance' }, (data) => handleDeleteInstance(data))
      .with({ type: 'executeCode' }, (data) => handleExecuteCode(data))
      .with({ type: 'executePeppermintCode' }, (data) => handleExecutePeppermintCode(data));

    self.postMessage({ type: 'success', id, result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
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
    peppermintReadyByNode.delete(nodeId);
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
    await ensurePeppermint(pyodide, nodeId);

    pyodide.globals.set('__patchies_pep_src', code);
    pyodide.globals.set('__patchies_pep_input', pyodide.toPy(input));

    const result = await pyodide.runPythonAsync(`
from peppermint.interpreter import Interpreter, Ok, Err
from peppermint.parser import parse
from peppermint.stdlib import build_global_env
from peppermint.context import Context
from pyodide.ffi import to_js
from js import Object
import patch

def __patchies_unwrap(value):
    if isinstance(value, Ok):
        return __patchies_unwrap(value.value)
    if isinstance(value, Err):
        return {"type": "Err", "message": value.msg}
    if isinstance(value, Context):
        return value.data
    return value

def __patchies_input():
    return __patchies_pep_input

def __patchies_print(value=None, *_args, **_kwargs):
    output = __patchies_unwrap(value)
    patch.send(
        to_js(output, dict_converter=Object.fromEntries),
        to_js({"to": 0}, dict_converter=Object.fromEntries),
    )
    return value

env = build_global_env()
env.set("input", __patchies_input)
env.set("print", __patchies_print)
interp = Interpreter(env, quiet=True)
__patchies_result = interp.run(parse(__patchies_pep_src))
None if __patchies_result is None else repr(__patchies_result)
`);

    self.postMessage({
      type: 'consoleOutput',
      nodeId,
      output: 'stdout',
      message: result === undefined || result === null ? null : String(result),
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

async function ensurePeppermint(pyodide: PyodideAPI, nodeId: string) {
  if (peppermintReadyByNode.has(nodeId)) {
    return;
  }

  await pyodide.loadPackage(['micropip', 'pandas'], {
    messageCallback: () => {},
    errorCallback: () => {},
    checkIntegrity: false
  });

  await pyodide.runPythonAsync(`
import micropip
await micropip.install("peppermint-lang==0.4.0a2")
`);

  peppermintReadyByNode.add(nodeId);
}

console.log('[pyodide worker] initialized');
