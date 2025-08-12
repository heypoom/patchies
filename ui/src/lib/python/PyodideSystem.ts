import type { PyodideAPI } from 'pyodide';

export class PyodideSystem {
	private static instance: PyodideSystem | null = null;

	pyodideModule: typeof import('pyodide') | null = null;
	pyodideByNode: Map<string, PyodideAPI> = new Map();

	async ensureModule() {
		if (this.pyodideModule !== null) return this.pyodideModule;

		this.pyodideModule = await import('pyodide');

		return this.pyodideModule;
	}

	async get(nodeId: string): Promise<PyodideAPI> {
		if (this.pyodideByNode.has(nodeId)) {
			return this.pyodideByNode.get(nodeId)!;
		}

		const pyodide = await this.ensureModule();

		const instance = await pyodide.loadPyodide({});
		this.pyodideByNode.set(nodeId, instance);

		return instance;
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
