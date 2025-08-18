import { match } from 'ts-pattern';
import type { PyodideAPI } from 'pyodide';
import type { PyodideWorkerMessage } from '$lib/python/PyodideSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';

/** Name of the Python package to interact with patchies */
const PATCHIES_PACKAGE = 'patch';

// Store pyodide instances by node ID
const pyodideByNode = new Map<string, PyodideAPI>();

self.onmessage = async (event: MessageEvent<PyodideWorkerMessage>) => {
	const { id } = event.data;

	try {
		const result = await match(event.data)
			.with({ type: 'createInstance' }, (data) => handleCreateInstance(data))
			.with({ type: 'deleteInstance' }, (data) => handleDeleteInstance(data))
			.with({ type: 'executeCode' }, (data) => handleExecuteCode(data));

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
		const result = await pyodide.runPython(code);

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

console.log('[pyodide worker] initialized');
