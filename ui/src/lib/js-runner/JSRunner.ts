import { getLibName, isSnippetModule } from './js-module-utils';
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
	public modules: Map<string, string> = new Map();
	private messageContextMap: Map<string, MessageContext> = new Map();

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
		} catch (error) {
			console.warn('rollup bundling error', error);
		}

		return '';
	}

	getMessageContext(nodeId: string): MessageContext {
		if (!this.messageContextMap.has(nodeId)) {
			this.messageContextMap.set(nodeId, new MessageContext(nodeId));
		}

		return this.messageContextMap.get(nodeId)!;
	}

	destroyMessageContext(nodeId: string): void {
		const context = this.messageContextMap.get(nodeId);
		if (!context) return;

		context.destroy();
		this.messageContextMap.delete(nodeId);
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

		const moduleName = `node-${nodeId}.js`;
		const isModule = isSnippetModule(code);
		console.log(`--- ${nodeId}::isModule`, isModule);

		if (isModule) {
			// If the module is tagged as `@lib <lib-name>`
			const libName = getLibName(code);
			if (libName) {
				this.modules.set(libName, code);
				setLibraryName(libName);
				return;
			} else {
				setLibraryName(null);
			}

			this.modules.set(moduleName, code);

			console.log(`--- bundling module`, moduleName);
			processedCode = await this.gen(moduleName);

			console.log(`--- generated`, processedCode);
		}

		console.log(`--- executing code for node ${nodeId}:\n`, processedCode);

		const codeWithWrapper = `
			const inner = async () => {
				var recv = receive = onMessage; // alias
				var delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
