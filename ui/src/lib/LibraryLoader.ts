import type P5 from 'p5';
import { match } from 'ts-pattern';

export interface Modules {
	p5: typeof P5;
	ml5: any;
}

export type ModuleName = keyof Modules;

export class LibraryLoader {
	private static instance: LibraryLoader | null = null;
	private loadedModules = new Map<ModuleName, unknown>();
	private loadingPromises = new Map<ModuleName, Promise<unknown>>();

	private constructor() {}

	static getInstance(): LibraryLoader {
		if (!LibraryLoader.instance) {
			LibraryLoader.instance = new LibraryLoader();
		}

		return LibraryLoader.instance;
	}

	async ensureModule<M extends ModuleName>(name: M): Promise<Modules[M]> {
		if (this.loadedModules.has(name)) {
			return this.loadedModules.get(name);
		}

		if (this.loadingPromises.has(name)) {
			return this.loadingPromises.get(name);
		}

		// Start loading the module
		const loadingPromise = this.loadModule(name);
		this.loadingPromises.set(name, loadingPromise);

		try {
			const module = await loadingPromise;
			this.loadedModules.set(name, module);
			this.loadingPromises.delete(name);

			return module;
		} catch (error) {
			this.loadingPromises.delete(name);
			throw error;
		}
	}

	private async loadModule<M extends ModuleName>(name: M): Promise<Modules[M]> {
		return match(name as ModuleName)
			.with('p5', async () => {
				const { default: P5 } = await import('p5');

				return P5;
			})
			.with('ml5', async () => {
				// @ts-expect-error -- no typedef for ML5.js
				const { default: ml5 } = await import('ml5');

				return ml5;
			})
			.exhaustive();
	}

	isLoaded<M extends ModuleName>(name: M): boolean {
		return this.loadedModules.has(name);
	}
}
