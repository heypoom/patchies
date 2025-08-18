import { loadModule, type LazyModules, type LazyModuleName } from './load-module';

type EnsuredModules<M extends readonly LazyModuleName[]> = {
	[K in keyof M]: M[K] extends LazyModuleName ? LazyModules[M[K]] : never;
};

export class LibraryLoader {
	private static instance: LibraryLoader | null = null;
	private loadedModules = new Map<LazyModuleName, unknown>();
	private loadingPromises = new Map<LazyModuleName, Promise<unknown>>();

	private constructor() {}

	static getInstance(): LibraryLoader {
		if (!LibraryLoader.instance) {
			LibraryLoader.instance = new LibraryLoader();
		}

		return LibraryLoader.instance;
	}

	async ensureModule<M extends LazyModuleName>(name: M): Promise<LazyModules[M]> {
		if (this.loadedModules.has(name)) {
			return this.loadedModules.get(name);
		}

		if (this.loadingPromises.has(name)) {
			return this.loadingPromises.get(name);
		}

		const loadingPromise = loadModule(name);
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

	async ensureModules<M extends readonly LazyModuleName[]>(
		...names: M
	): Promise<EnsuredModules<M>> {
		return Promise.all(names.map((name) => this.ensureModule(name))) as EnsuredModules<M>;
	}

	isLoaded<M extends LazyModuleName>(name: M): boolean {
		return this.loadedModules.has(name);
	}
}
