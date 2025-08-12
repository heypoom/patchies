export class PyodideSystem {
	private static instance: PyodideSystem | null = null;

	pyodide: typeof import('pyodide') | null = null;

	async ensureModule() {
		if (this.pyodide !== null) return this.pyodide;

		this.pyodide = await import('pyodide');

		return this.pyodide;
	}

	async load() {
		const pyodide = await this.ensureModule();

		await pyodide.loadPyodide({});

		return;
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
