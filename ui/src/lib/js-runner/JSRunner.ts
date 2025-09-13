import { getLibName, isSnippetModule } from './js-module-utils';

export class JSRunner {
	private static instance: JSRunner;
	public modules: Map<string, string> = new Map();

	async gen(): Promise<string> {
		const { rollup } = await import('@rollup/browser');

		const bundle = await rollup({
			input: 'main.js',
			plugins: [
				{
					name: 'loader',
					resolveId: (source) => {
						if (this.modules.has(source)) {
							return source;
						}
					},
					load: (id) => {
						if (this.modules.has(id)) {
							return this.modules.get(id);
						}
					}
				}
			]
		});

		const { output } = await bundle.generate({ format: 'es' });

		return output[0].code;
	}

	processModules(code: string) {
		if (!code) return;
		if (!isSnippetModule(code)) return;

		// If the module is tagged as `@lib <lib-name>`
		const libName = getLibName(code);
		if (libName) {
			this.modules.set(libName, code);
			return;
		}
	}

	public static getInstance(): JSRunner {
		if (!JSRunner.instance) {
			JSRunner.instance = new JSRunner();
		}

		return JSRunner.instance;
	}
}
