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
	extraContext?: Record<string, unknown>;
	isAsync?: boolean;
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

	async preprocessCode(
		code: string,
		options: {
			nodeId: string;
			setLibraryName: (name: string | null) => void;
		}
	): Promise<string | null> {
		const { nodeId, setLibraryName } = options;

		const isModule = isSnippetModule(code);

		if (isModule) {
			const moduleName = getModuleNameByNode(nodeId);

			// If the module is tagged as `@lib <lib-name>`
			const libName = getLibName(code);

			if (libName) {
				this.setLibraryCode(nodeId, code);
				setLibraryName(libName);

				return null;
			}

			// Un-register library (if any)
			const previousLibName = this.libraryNamesByNode.get(nodeId);
			if (previousLibName) {
				this.modules.delete(previousLibName);
				this.libraryNamesByNode.delete(nodeId);
			}

			setLibraryName(null);

			this.modules.set(moduleName, code);

			return this.gen(moduleName);
		}

		return code;
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

	executeJavaScript(nodeId: string, code: string, options: JSRunnerOptions = {}) {
		const messageContext = this.getMessageContext(nodeId);

		messageContext.clearTimers();

		const {
			customConsole = console,
			setPortCount = () => {},
			setRunOnMount = () => {},
			setTitle = () => {},
			extraContext = {}
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
			'setTitle',
			...Object.keys(extraContext)
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
			setTitle,
			...Object.values(extraContext)
		];

		const asyncKeyword = options.isAsync ? 'async' : '';

		const codeWithWrapper = `
			const inner = ${asyncKeyword} () => {
				var recv = receive = onMessage; // alias
				var delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
				var esm = (name) => import('${this.moduleProviderUrl}' + name);

				${code}
			}

			return inner()
		`;

		const userFunction = new Function(...functionParams, codeWithWrapper);

		return userFunction(...functionArgs);
	}

	setLibraryCode(nodeId: string, code: string) {
		const libName = getLibName(code);
		if (!libName) return;

		this.libraryNamesByNode.set(nodeId, libName);
		this.modules.set(libName, code);
	}

	public static getInstance(): JSRunner {
		if (!JSRunner.instance) {
			JSRunner.instance = new JSRunner();
		}

		return JSRunner.instance;
	}
}
