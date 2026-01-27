import { getLibName, getModuleNameByNode, isSnippetModule } from './js-module-utils';
import { MessageContext } from '$lib/messages/MessageContext';
import { createLLMFunction } from '$lib/ai/google';
import { debounce } from 'lodash';
import { createGetVfsUrl, revokeObjectUrls } from '$lib/vfs';

export interface JSRunnerOptions {
	customConsole?: {
		log: (...args: unknown[]) => void;
		error: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
	};

	setPortCount?: (inletCount?: number, outletCount?: number) => void;
	setRunOnMount?: (runOnMount?: boolean) => void;
	setTitle?: (title: string) => void;
	setHidePorts?: (hidePorts: boolean) => void;
	extraContext?: Record<string, unknown>;
}

const SET_JS_LIBRARY_CODE_DEBOUNCE = 500;

export class JSRunner {
	private static instance: JSRunner;

	public moduleProviderUrl = `https://esm.sh/`;
	public modules: Map<string, string> = new Map();
	private messageContextMap: Map<string, MessageContext> = new Map();

	/** Avoid collision caused by multiple nodes having same library names. */
	private libraryNamesByNode: Map<string, string> = new Map();

	private sendToRenderWorker?: (moduleName: string, code: string | null) => void;
	private sendToRenderWorkerSlow?: (moduleName: string, code: string | null) => void;

	async gen(inputName: string): Promise<string> {
		try {
			const { rollup } = await import('@rollup/browser');

			const importMappings = new Map();

			const bundle = await rollup({
				input: inputName,
				plugins: [
					{
						name: 'loader',

						moduleParsed(moduleInfo) {
							const body = moduleInfo.ast?.body;
							if (!body) return;

							// Find and store import declarations as before
							for (const node of body) {
								if (node.type === 'ImportDeclaration') {
									const importSource = node.source.value;

									for (const specifier of node.specifiers) {
										const isDefault = specifier.type === 'ImportDefaultSpecifier';
										const localName = specifier.local.name;

										const key = `${importSource}!!${localName}!!${isDefault ? 'default' : 'named'}`;

										// import sources must start with 'npm'
										if (typeof importSource !== 'string' || !importSource.startsWith('npm:'))
											continue;

										importMappings.set(key, {
											source: importSource,
											localName,
											isDefault
										});
									}
								}
							}
						},
						resolveId: (source) => {
							if (this.modules.has(source)) {
								return source;
							}
						},
						load: async (id) => {
							if (this.modules.has(id)) {
								return this.modules.get(id);
							}
						},
						renderChunk(code) {
							let transformedCode = code;

							// Group imports by source to handle multiple named imports from same source
							const importsBySource = new Map<
								string,
								{ namedImports: string[]; defaultImport: string | null }
							>();

							for (const { localName, source, isDefault } of importMappings.values()) {
								if (!importsBySource.has(source)) {
									importsBySource.set(source, { namedImports: [], defaultImport: null });
								}

								const group = importsBySource.get(source)!;
								if (isDefault) {
									group.defaultImport = localName;
								} else {
									group.namedImports.push(localName);
								}
							}

							// Process each source once
							for (const [source, { namedImports, defaultImport }] of importsBySource) {
								const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
								const packageName = source.replace('npm:', '');

								// Match the entire import statement for this source
								const importRegex = new RegExp(
									`^\\s*import\\s+(?:[\\w\\s{},*]+)\\s+from\\s+['"]${escapedSource}['"];?\\s*`,
									'm'
								);

								const match = transformedCode.match(importRegex);

								if (match) {
									const fullStatement = match[0];
									const replacements: string[] = [];

									if (defaultImport) {
										replacements.push(
											`const ${defaultImport} = (await esm('${packageName}')).default`
										);
									}

									if (namedImports.length > 0) {
										replacements.push(
											`const { ${namedImports.join(', ')} } = await esm('${packageName}')`
										);
									}

									transformedCode = transformedCode.replace(
										fullStatement,
										replacements.join('\n') + '\n'
									);
								}

								// Process side effect imports
								transformedCode = transformedCode.replace(
									`import '${source}'`,
									`await esm('${packageName}')`
								);
							}

							return transformedCode;
						}
					}
				]
			});

			const { output } = await bundle.generate({ format: 'es' });

			return output[0].code;
		} catch (error) {
			console.warn('rollup bundling error', error);
		}

		return '';
	}

	/** Wait for module dependencies to be available */
	private async waitForDependencies(code: string, maxWait = 5000): Promise<void> {
		const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
		const dependencies = new Set<string>();
		let match;

		// Extract all import statements
		while ((match = importRegex.exec(code)) !== null) {
			const moduleName = match[1];

			if (!moduleName.startsWith('npm:') && !moduleName.startsWith('http')) {
				dependencies.add(moduleName);
			}
		}

		const startTime = Date.now();

		// wait for all dependencies to be available.
		for (const dependency of dependencies) {
			while (!this.modules.has(dependency)) {
				if (Date.now() - startTime > maxWait) {
					console.warn(`dependency '${dependency}' not found within ${maxWait}ms`);
					break;
				}

				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}
	}

	async preprocessCode(
		code: string,
		options: {
			nodeId: string;
			setLibraryName?: (name: string | null) => void;
		}
	): Promise<string | null> {
		const { nodeId, setLibraryName } = options;

		// Wait for module dependencies first
		await this.waitForDependencies(code);

		const isModule = isSnippetModule(code);

		if (isModule) {
			const moduleName = getModuleNameByNode(nodeId);

			// If the module is tagged as `@lib <lib-name>`
			const libName = getLibName(code);

			if (libName) {
				this.setLibraryCode(nodeId, code);
				setLibraryName?.(libName);

				return null;
			}

			// Un-register library (if any)
			const previousLibName = this.libraryNamesByNode.get(nodeId);
			if (previousLibName) {
				this.libraryNamesByNode.delete(nodeId);
				this.setModuleAndSync(previousLibName, null);
			}

			setLibraryName?.(null);

			this.setModuleAndSync(moduleName, code);

			return this.gen(moduleName);
		}

		return code;
	}

	getMessageContext(nodeId: string): MessageContext {
		if (!this.messageContextMap.has(nodeId)) {
			this.messageContextMap.set(nodeId, new MessageContext(nodeId));
		}

		return this.messageContextMap.get(nodeId)!;
	}

	destroy(nodeId: string): void {
		const libraryName = this.libraryNamesByNode.get(nodeId);

		if (libraryName) {
			this.libraryNamesByNode.delete(nodeId);
			this.setModuleAndSync(libraryName, null);
		}

		// Destroy context before removing from map (runs cleanup callbacks)
		const context = this.messageContextMap.get(nodeId);
		if (context) {
			context.destroy();
		}

		this.messageContextMap.delete(nodeId);

		revokeObjectUrls(nodeId);

		const moduleName = getModuleNameByNode(nodeId);
		if (this.modules.has(moduleName)) {
			this.setModuleAndSync(moduleName, null);
		}
	}

	executeJavaScript(nodeId: string, code: string, options: JSRunnerOptions = {}) {
		const messageContext = this.getMessageContext(nodeId);

		messageContext.runCleanupCallbacks();
		messageContext.clearTimers();

		const {
			customConsole = console,
			setPortCount = () => {},
			setRunOnMount = () => {},
			setTitle = () => {},
			setHidePorts = () => {},
			extraContext = {}
		} = options;

		const messageSystemContext = messageContext.getContext();

		const functionParams = [
			'console',
			'send',
			'onMessage',
			'setInterval',
			'setTimeout',
			'delay',
			'requestAnimationFrame',
			'onCleanup',
			'fft',
			'llm',
			'setPortCount',
			'setRunOnMount',
			'setTitle',
			'setHidePorts',
			'getVfsUrl',
			...Object.keys(extraContext)
		];

		const functionArgs = [
			customConsole,
			messageSystemContext.send,
			messageSystemContext.onMessage,
			messageSystemContext.setInterval,
			messageSystemContext.setTimeout,
			messageSystemContext.delay,
			messageSystemContext.requestAnimationFrame,
			messageSystemContext.onCleanup,
			messageSystemContext.fft,
			createLLMFunction(),
			setPortCount,
			setRunOnMount,
			setTitle,
			setHidePorts,
			createGetVfsUrl(nodeId),
			...Object.values(extraContext)
		];

		const codeWithWrapper = `
			const inner = async () => {
				var recv = onMessage; // alias
				var esm = (name) => import('${this.moduleProviderUrl}' + name);

				${code}
			}

			return inner()
		`;

		const userFunction = new Function(...functionParams, codeWithWrapper);

		return userFunction(...functionArgs);
	}

	async setLibraryCode(nodeId: string, code: string) {
		const libName = getLibName(code);
		if (!libName) return;

		this.libraryNamesByNode.set(nodeId, libName);
		this.modules.set(libName, code);

		await this.ensureRenderWorker();

		this.sendToRenderWorkerSlow?.(libName, code);
	}

	private setModuleAndSync(moduleName: string, code: string | null) {
		if (code === null) {
			this.modules.delete(moduleName);
		} else {
			this.modules.set(moduleName, code);
		}

		this.sendToRenderWorker?.(moduleName, code);
	}

	async ensureRenderWorker() {
		if (typeof window === 'undefined') return;

		const { GLSystem } = await import('../canvas/GLSystem');

		this.sendToRenderWorker = (moduleName: string, code: string | null) =>
			GLSystem.getInstance().send('updateJSModule', { moduleName, code });

		this.sendToRenderWorkerSlow = debounce(this.sendToRenderWorker, SET_JS_LIBRARY_CODE_DEBOUNCE);
	}

	public static getInstance(): JSRunner {
		if (!JSRunner.instance) {
			JSRunner.instance = new JSRunner();
		}

		return JSRunner.instance;
	}
}
