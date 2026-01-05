/**
 * Orca Renderer
 * Handles all canvas rendering logic for the Orca grid
 * Adapted from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 */

import type { Orca } from './Orca';

interface OrcaColors {
	background: string;
	f_high: string;
	f_med: string;
	f_low: string;
	f_inv: string;
	b_high: string;
	b_med: string;
	b_low: string;
	b_inv: string;
	cursor: string;
}

export class OrcaRenderer {
	private orca: Orca;
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private colors: OrcaColors;
	private scale: number;
	private tileW: number;
	private tileH: number;
	private tileWS: number;
	private tileHS: number;
	private ports: Array<[number, number, number, string] | undefined> = [];

	constructor(canvas: HTMLCanvasElement, orca: Orca, colors: OrcaColors) {
		this.canvas = canvas;
		this.orca = orca;
		this.colors = colors;
		this.scale = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
		this.tileW = 10;
		this.tileH = 15;
		this.tileWS = Math.floor(this.tileW * this.scale);
		this.tileHS = Math.floor(this.tileH * this.scale);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Could not get 2D context from canvas');
		}
		this.ctx = ctx;
	}

	findPorts(): void {
		this.ports = new Array(this.orca.w * this.orca.h - 1);
		for (const operator of this.orca.runtime) {
			if (this.orca.lockAt(operator.x, operator.y)) continue;
			const operatorPorts = operator.getPorts();
			for (const port of operatorPorts) {
				const index = this.orca.indexAt(port[0], port[1]);
				this.ports[index] = port;
			}
		}
	}

	isMarker(x: number, y: number): boolean {
		// Markers appear at grid boundaries
		return x % this.orca.w === 0 && y % this.orca.h === 0;
	}

	isInvisible(x: number, y: number): boolean {
		// A cell is invisible if:
		// - It's empty (.)
		// - Not a marker
		// - Not locked
		// - Has no port
		const glyph = this.orca.glyphAt(x, y);
		const hasPort = this.ports[this.orca.indexAt(x, y)] !== undefined;
		const isLocked = this.orca.lockAt(x, y);
		const isMarker = this.isMarker(x, y);

		return glyph === '.' && !isMarker && !isLocked && !hasPort;
	}

	render(cursorX: number, cursorY: number, isPaused: boolean): void {
		// Update ports map
		this.findPorts();

		// Set canvas dimensions
		const width = this.tileWS * this.orca.w;
		const height = (this.tileHS + this.tileHS / 5) * this.orca.h;

		// Only resize canvas if dimensions changed
		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
			this.canvas.style.width = `${Math.ceil(this.tileW * this.orca.w)}px`;
			this.canvas.style.height = `${Math.ceil((this.tileH + this.tileH / 5) * this.orca.h)}px`;

			// Setup context
			this.ctx.textBaseline = 'bottom';
			this.ctx.textAlign = 'center';
			this.ctx.font = `${this.tileHS * 0.75}px monospace`;
		}

		// Clear canvas
		this.ctx.fillStyle = this.colors.background;
		this.ctx.fillRect(0, 0, width, height);

		// Draw grid
		for (let y = 0; y < this.orca.h; y++) {
			for (let x = 0; x < this.orca.w; x++) {
				// Skip invisible cells
				if (this.isInvisible(x, y) && !(x === cursorX && y === cursorY)) {
					continue;
				}

				const glyph = this.orca.glyphAt(x, y);
				const isCursor = x === cursorX && y === cursorY;
				const isLocked = this.orca.lockAt(x, y);
				const port = this.ports[this.orca.indexAt(x, y)];

				this.drawSprite(x, y, glyph, isCursor, isLocked, isPaused, port);
			}
		}
	}

	private drawSprite(
		x: number,
		y: number,
		glyph: string,
		isCursor: boolean,
		isLocked: boolean,
		isPaused: boolean,
		port?: [number, number, number, string]
	): void {
		// Determine what to display
		let displayGlyph = glyph;
		if (glyph === '.') {
			if (isCursor) {
				displayGlyph = isPaused ? '~' : '@';
			} else if (this.isMarker(x, y)) {
				displayGlyph = '+';
			}
		}

		const theme = this.makeTheme(glyph, isCursor, isLocked, port);

		// Draw background if present
		if (theme.bg) {
			this.ctx.fillStyle = theme.bg;
			this.ctx.fillRect(x * this.tileWS, y * this.tileHS, this.tileWS, this.tileHS);
		}

		// Draw foreground text if present
		if (theme.fg) {
			this.ctx.fillStyle = theme.fg;
			this.ctx.fillText(displayGlyph, (x + 0.5) * this.tileWS, (y + 1) * this.tileHS);
		}
	}

	private makeTheme(
		glyph: string,
		isCursor: boolean,
		isLocked: boolean,
		port?: [number, number, number, string]
	): { bg?: string; fg?: string } {
		// Cursor (selected)
		if (isCursor) {
			return { bg: this.colors.b_inv, fg: this.colors.f_inv };
		}

		// Bang operator
		if (glyph === '*' && !isLocked) {
			return { fg: this.colors.b_high };
		}

		// Port styling (if port exists, use its type for styling)
		if (port) {
			const portType = port[2];
			// type 0: operator (already handled by uppercase check below)
			// type 1: haste port (inputs at negative positions)
			if (portType === 1) {
				return { fg: this.colors.b_med };
			}
			// type 2: input port
			if (portType === 2) {
				return { fg: this.colors.b_high };
			}
			// type 3: output port
			if (portType === 3) {
				return { bg: this.colors.b_high, fg: this.colors.f_low };
			}
		}

		// Uppercase (passive) operators
		if (
			glyph !== '.' &&
			glyph === glyph.toUpperCase() &&
			glyph.toLowerCase() !== glyph.toUpperCase()
		) {
			return { bg: this.colors.b_med, fg: this.colors.f_low };
		}

		// Locked cells
		if (isLocked) {
			return { fg: this.colors.f_med };
		}

		// Comment
		if (glyph === '#') {
			return { fg: this.colors.f_med };
		}

		// Default
		return { fg: this.colors.f_low };
	}

	resize(): void {
		// This will be handled automatically on next render
	}
}
