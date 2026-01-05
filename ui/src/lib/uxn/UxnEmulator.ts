// Uxn Emulator - main emulator class
// Ported from uxn5/src/emu.js

import type { Uxn } from 'uxn.wasm';
import { DateTimeDevice } from './devices/DateTimeDevice';
import { SystemDevice } from './devices/SystemDevice';
import { ConsoleDevice, type ConsoleOutputCallback } from './devices/ConsoleDevice';
import { ControllerDevice } from './devices/ControllerDevice';
import { ScreenDevice } from './devices/ScreenDevice';
import { MouseDevice } from './devices/MouseDevice';
import { default_zoom } from './boot';

export interface UxnEmulatorOptions {
	nodeId: string;
	canvasElement?: HTMLCanvasElement;
	onConsoleOutput?: ConsoleOutputCallback;
	keyctrl?: boolean;
}

export class UxnEmulator {
	public system: SystemDevice;
	public console: ConsoleDevice;
	public controller: ControllerDevice;
	public screen: ScreenDevice;
	public datetime: DateTimeDevice;
	public mouse: MouseDevice;
	public uxn: Uxn | null = null;

	private renderLoopId: ReturnType<typeof setInterval> | null = null;
	private isRunning: boolean = false;
	private uxnModule: typeof import('uxn.wasm') | null = null;

	constructor(options: UxnEmulatorOptions) {
		// Initialize devices
		this.system = new SystemDevice(this);
		this.console = new ConsoleDevice(this, options.onConsoleOutput);
		this.controller = new ControllerDevice(this, options.keyctrl || false);
		this.screen = new ScreenDevice(this);
		this.datetime = new DateTimeDevice(this);
		this.mouse = new MouseDevice(this);
	}

	async init(options: UxnEmulatorOptions): Promise<void> {
		// Lazy-load uxn.wasm module
		if (!this.uxnModule) {
			this.uxnModule = await import('uxn.wasm');
		}

		// Initialize Uxn core (using uxn.wasm)
		this.uxn = new this.uxnModule.Uxn();
		console.log('uxn loaded!');

		// Initialize Uxn core with dei/deo callbacks
		await this.uxn.init({
			dei: (port: number) => this.dei(port),
			deo: (port: number, val: number) => this.deo(port, val)
		});

		// Initialize devices
		this.console.start();
		if (options.canvasElement) {
			this.screen.init(options.canvasElement);
		}
		// Controller doesn't need init (events handled at node level)
		// Mouse doesn't need init (events handled at node level)

		// Start render loop
		this.startRenderLoop();
	}

	public startRenderLoop(): void {
		if (this.renderLoopId !== null) return;

		this.isRunning = true;
		const intervalId = setInterval(() => {
			if (!this.isRunning) {
				clearInterval(intervalId);
				return;
			}

			window.requestAnimationFrame(() => {
				// Call screen vector if set
				if (this.screen.vector && this.uxn) {
					this.uxn.eval(this.screen.vector);
				}

				// Handle repaint (full redraw)
				if (this.screen.repaint) {
					this.screen.x1 = 0;
					this.screen.y1 = 0;
					this.screen.x2 = this.screen.width;
					this.screen.y2 = this.screen.height;
					this.screen.repaint = 0;
					const x = this.screen.x1;
					const y = this.screen.y1;
					const w = this.screen.x2 - x;
					const h = this.screen.y2 - y;
					this.screen.redraw();
					if (this.screen.displayctx) {
						const imagedata = new ImageData(
							Uint8ClampedArray.from(this.screen.pixels),
							this.screen.width,
							this.screen.height
						);
						this.screen.displayctx.putImageData(imagedata, 0, 0, x, y, w, h);
					}
				}

				// Handle dirty rectangles
				if (this.screen.changed()) {
					const x = this.screen.x1;
					const y = this.screen.y1;
					const w = this.screen.x2 - x;
					const h = this.screen.y2 - y;
					this.screen.redraw();
					if (this.screen.displayctx) {
						const imagedata = new ImageData(
							Uint8ClampedArray.from(this.screen.pixels),
							this.screen.width,
							this.screen.height
						);
						this.screen.displayctx.putImageData(imagedata, 0, 0, x, y, w, h);
					}
				}
			});
		}, 1000 / 60);

		this.renderLoopId = intervalId;
	}

	stopRenderLoop(): void {
		this.isRunning = false;
		if (this.renderLoopId !== null) {
			clearInterval(this.renderLoopId);
			this.renderLoopId = null;
		}
	}

	start(rom: Uint8Array): void {
		if (!this.uxn) return;

		this.console.start();
		this.screen.set_zoom(default_zoom || 1);
		this.uxn.load(rom);
		this.uxn.eval(0x0100);
	}

	load(rom: Uint8Array): void {
		this.start(rom);
	}

	dei(port: number): number {
		if (!this.uxn) return 0;

		switch (port & 0xf0) {
			case 0xc0:
				return this.datetime.dei(port);
			case 0x20:
				return this.screen.dei(port);
		}

		return this.uxn.dev[port];
	}

	deo(port: number, val: number): void {
		if (!this.uxn) return;

		this.uxn.dev[port] = val;

		switch (port & 0xf0) {
			case 0x00:
				this.system.deo(port);
				break;
			case 0x10:
				this.console.deo(port);
				break;
			case 0x20:
				this.screen.deo(port);
				break;
		}
	}

	destroy(): void {
		this.stopRenderLoop();
	}
}
