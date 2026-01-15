import type { Textmodifier } from 'textmode.js';
import type { TextmodeRenderMode } from '../../workers/rendering/textmodeRenderer';

export interface DomTextmodeConfig {
	width: number;
	height: number;
	fontSize?: number;
	frameRate?: number;
}

export class DomTextmodeManager {
	public textmode: Textmodifier | null = null;
	public canvas: HTMLCanvasElement | null = null;

	private config: DomTextmodeConfig;

	public onFastRenderMode = () => {};

	constructor(config: DomTextmodeConfig) {
		this.config = config;
	}

	async init(canvas: HTMLCanvasElement): Promise<void> {
		this.canvas = canvas;

		const textmode = await import('textmode.js');
		this.textmode = textmode.create({
			width: this.config.width,
			height: this.config.height,
			fontSize: this.config.fontSize ?? 18,
			frameRate: this.config.frameRate ?? 60,
			canvas
		});
	}

	runCode(code: string): void {
		if (!this.textmode) return;

		try {
			const context = {
				tm: this.textmode,
				canvas: this.canvas,
				width: this.config.width,
				height: this.config.height,

				setRenderMode: (renderMode: TextmodeRenderMode) => {
					if (renderMode === 'fast') {
						console.log('dom -> fast');
						this.onFastRenderMode();
					}
				},
				setPortCount: () => {}
			};

			const funcBody = `
				with (arguments[0]) {
					${code}
				}
			`;

			new Function(funcBody)(context);
		} catch (error) {
			console.error('[DomTextmodeManager] code execution error:', error);
		}
	}

	destroy(): void {
		if (this.textmode) {
			this.textmode.destroy();
			this.textmode = null;
		}

		this.canvas = null;
	}
}
