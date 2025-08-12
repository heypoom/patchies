import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { MessageContext } from '$lib/messages/MessageContext';

import type { PyodideAPI } from 'pyodide';

/** Name of the Python package to interact with patchies */
const PATCHIES_PACKAGE = 'patch';

export class PyodideSystem {
	private static instance: PyodideSystem | null = null;

	eventBus = PatchiesEventBus.getInstance();

	pyodideModule: typeof import('pyodide') | null = null;
	pyodideByNode: Map<string, PyodideAPI> = new Map();

	async ensureModule() {
		if (this.pyodideModule !== null) return this.pyodideModule;

		this.pyodideModule = await import('pyodide');

		return this.pyodideModule;
	}

	get(nodeId: string): PyodideAPI | undefined {
		return this.pyodideByNode.get(nodeId);
	}

	// TODO: cleanup pyodide properly...
	delete(nodeId: string): void {
		const pyodide = this.pyodideByNode.get(nodeId);
		pyodide?.unregisterJsModule(PATCHIES_PACKAGE);

		this.pyodideByNode.delete(nodeId);
	}

	async create(nodeId: string, options: { messageContext: MessageContext }): Promise<PyodideAPI> {
		// If we already have this node created
		if (this.pyodideByNode.has(nodeId)) {
			return this.pyodideByNode.get(nodeId)!;
		}

		const pyodideModule = await this.ensureModule();

		const patchiesModule = {
			// Connect Python to the global message context
			...options.messageContext.getContext()
		};

		const pyodide = await pyodideModule.loadPyodide({
			env: {
				PATCHIES_NODE_ID: nodeId
			},
			stdout: (message: string) => {
				this.eventBus.dispatch({ type: 'pyodideConsoleOutput', output: 'stdout', message, nodeId });
			},
			stderr: (message: string) => {
				this.eventBus.dispatch({ type: 'pyodideConsoleOutput', output: 'stderr', message, nodeId });
			}
		});

		pyodide.registerJsModule(PATCHIES_PACKAGE, patchiesModule);

		this.pyodideByNode.set(nodeId, pyodide);

		return pyodide;
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new PyodideSystem();
		}

		// @ts-expect-error -- expose globally for debugging
		window.pyodide = this.instance;

		return this.instance;
	}
}
