import { getLibName, getModuleNameByNode, isSnippetModule } from './js-module-utils';
import { MessageContext } from '$lib/messages/MessageContext';
import { createLLMFunction } from '$lib/ai/google';

export interface JSRunnerOptions {
	customConsole?: {
		log: (...args: unknown[]) => void;
		error: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
	};

	setPortCount?: (inletCount?: number, outletCount?: number) => void;
	setRunOnMount?: (runOnMount?: boolean) => void;
	setTitle?: (title: string) => void;
	setLibraryName?: (libraryName: string | null) => void;
}

export class JSRunner {
	private static instance: JSRunner;

	public moduleProviderUrl = `https://esm.run/`;
	public modules: Map<string, string> = new Map();
	private messageContextMap: Map<string, MessageContext> = new Map();

	/** Avoid collision caused by multiple nodes having same library names. */
	private libraryNamesByNode: Map<string, string> = new Map();

	private moduleCache: Map<string, string> = new Map();

	async gen(inputName: string): Promise<string> {
		try {
			const { rollup } = await import('@rollup/browser');

			const bundle = await rollup({
				input: inputName,
				plugins: [
					{
						name: 'loader',
						resolveId: (source) => {
							if (this.modules.has(source)) {
								return source;
							}
						},
						load: async (id) => {
							if (this.modules.has(id)) {
								return this.modules.get(id);
							}
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

	async loadExternalModule(id: string) {
		if (this.moduleCache.has(id)) {
			return this.moduleCache.get(id);
		}

		const response = await fetch(id);

		if (!response.ok) {
			throw new Error(`Failed to fetch ${id}: ${response.statusText}`);
		}

		const code = await response.text();
		this.moduleCache.set(id, code);

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
			this.modules.delete(libraryName);
		}

		this.libraryNamesByNode.delete(nodeId);
		this.messageContextMap.delete(nodeId);
		this.modules.delete(getModuleNameByNode(nodeId));

		const context = this.messageContextMap.get(nodeId);
		if (context) {
			context.destroy();
		}
	}

	async executeJavaScript(
		nodeId: string,
		code: string,
		options: JSRunnerOptions = {}
	): Promise<void> {
		const messageContext = this.getMessageContext(nodeId);

		messageContext.clearTimers();

		const {
			customConsole = console,
			setPortCount = () => {},
			setRunOnMount = () => {},
			setTitle = () => {},
			setLibraryName = () => {}
		} = options;

		const messageSystemContext = messageContext.getContext();

		const functionParams = [
			'console',
			'send',
			'onMessage',
			'setInterval',
			'requestAnimationFrame',
			'fft',
			'llm',
			'setPortCount',
			'setRunOnMount',
			'setTitle'
		];

		const functionArgs = [
			customConsole,
			messageSystemContext.send,
			messageSystemContext.onMessage,
			messageSystemContext.setInterval,
			messageSystemContext.requestAnimationFrame,
			messageSystemContext.fft,
			createLLMFunction(),
			setPortCount,
			setRunOnMount,
			setTitle
		];

		let processedCode = code;

		const isModule = isSnippetModule(code);

		if (isModule) {
			const moduleName = getModuleNameByNode(nodeId);

			// If the module is tagged as `@lib <lib-name>`
			const libName = getLibName(code);

			if (libName) {
				this.modules.set(libName, code);
				this.libraryNamesByNode.set(nodeId, libName);

				setLibraryName(libName);
				return;
			} else {
				// Un-register library
				const previousLibName = this.libraryNamesByNode.get(nodeId);
				if (previousLibName) {
					this.modules.delete(previousLibName);
					this.libraryNamesByNode.delete(nodeId);
				}

				setLibraryName(null);
			}

			this.modules.set(moduleName, code);
			processedCode = await this.gen(moduleName);
		}

		const codeWithWrapper = `
			const inner = async () => {
				var recv = receive = onMessage; // alias
				var delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
				var esm = (name) => import('${this.moduleProviderUrl}' + name);

				${processedCode}
			}

			return inner()
		`;

		const userFunction = new Function(...functionParams, codeWithWrapper);

		await userFunction(...functionArgs);
	}

	public static getInstance(): JSRunner {
		if (!JSRunner.instance) {
			JSRunner.instance = new JSRunner();
		}

		return JSRunner.instance;
	}
}
