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
	private fontScale: number;
	private tileW: number;
	private tileH: number;
	private tileWS: number;
	private tileHS: number;
	private ports: Array<[number, number, number, string] | undefined> = [];

	constructor(
		canvas: HTMLCanvasElement,
		orca: Orca,
		colors: OrcaColors,
		fontScale: number,
		canvasScale: number
	) {
		this.canvas = canvas;
		this.orca = orca;
		this.colors = colors;
		this.fontScale = fontScale;

		this.scale = canvasScale;

		this.tileW = 10 * fontScale;
		this.tileH = 15 * fontScale;
		this.tileWS = Math.floor(this.tileW * this.scale);
		this.tileHS = Math.floor(this.tileH * this.scale);

		const ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Could not get 2D context from canvas');
		}
		this.ctx = ctx;
	}

	updateFontScale(fontScale: number): void {
		this.fontScale = fontScale;
		this.tileW = 10 * fontScale;
		this.tileH = 15 * fontScale;
		this.tileWS = Math.floor(this.tileW * this.scale);
		this.tileHS = Math.floor(this.tileH * this.scale);
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
		// Markers appear at 8x8 grid intervals (matching original Orca)
		const gridSize = 8;
		return x % gridSize === 0 && y % gridSize === 0;
	}

	isNear(x: number, y: number, cursorX: number, cursorY: number): boolean {
		// Check if position is in the same subgrid as cursor
		const gridSize = 8;
		const cursorGridX = Math.floor(cursorX / gridSize);
		const cursorGridY = Math.floor(cursorY / gridSize);
		const cellGridX = Math.floor(x / gridSize);
		const cellGridY = Math.floor(y / gridSize);
		return cellGridX === cursorGridX && cellGridY === cursorGridY;
	}

	isLocals(x: number, y: number, cursorX: number, cursorY: number): boolean {
		// Local markers: smaller grid markers (every 4 cells) near cursor
		const localGridSize = 4;
		return (
			this.isNear(x, y, cursorX, cursorY) && x % localGridSize === 0 && y % localGridSize === 0
		);
	}

	isInvisible(x: number, y: number, cursorX: number, cursorY: number): boolean {
		// A cell is invisible if:
		// - It's empty (.)
		// - Not a marker
		// - Not a local marker
		// - Not locked
		// - Has no port
		const glyph = this.orca.glyphAt(x, y);
		const hasPort = this.ports[this.orca.indexAt(x, y)] !== undefined;
		const isLocked = this.orca.lockAt(x, y);
		const isMarker = this.isMarker(x, y);
		const isLocalMarker = this.isLocals(x, y, cursorX, cursorY);

		return glyph === '.' && !isMarker && !isLocalMarker && !isLocked && !hasPort;
	}

	write(
		text: string,
		offsetX: number,
		offsetY: number,
		limit: number = 50,
		colorType: keyof OrcaColors = 'f_low'
	): void {
		if (!this.ctx) return;

		const color = this.colors[colorType] || this.colors.f_low;
		this.ctx.fillStyle = color;

		for (let x = 0; x < text.length && x < limit; x++) {
			const char = text.charAt(x);
			this.ctx.fillText(char, (offsetX + x + 0.5) * this.tileWS, (offsetY + 1) * this.tileHS);
		}
	}

	drawInterface(
		cursorX: number,
		cursorY: number,
		isPaused: boolean,
		selectionW: number,
		selectionH: number
	): void {
		if (!this.ctx) return;

		const gridSize = 8;
		const offsetX = 1; // Left padding (1 tile)
		const interfaceY = this.orca.h + 1;

		// Get operator info at cursor (matching original Orca's cursor.inspect())
		let operatorInfo = '';
		if (selectionW !== 0 || selectionH !== 0) {
			operatorInfo = 'multi';
		} else {
			const index = this.orca.indexAt(cursorX, cursorY);
			const port = this.ports[index];
			if (port) {
				operatorInfo = port[3]; // Port name (e.g., "Random", "Uclid")
			} else if (this.orca.lockAt(cursorX, cursorY)) {
				operatorInfo = 'locked';
			} else {
				operatorInfo = 'empty';
			}
		}

		// Line 1: Operator info, position, grid size, frame count
		this.write(operatorInfo, offsetX + gridSize * 0, interfaceY, gridSize - 1, 'f_med');
		this.write(`${cursorX},${cursorY}`, offsetX + gridSize * 1, interfaceY, gridSize, 'f_low');
		this.write(
			`${this.orca.w}:${this.orca.h}`,
			offsetX + gridSize * 2,
			interfaceY,
			gridSize,
			'f_low'
		);
		this.write(
			`${this.orca.f}f${isPaused ? '~' : ''}`,
			offsetX + gridSize * 3,
			interfaceY,
			gridSize,
			'f_med'
		);

		// Show variables if any (on same line, to the right)
		const varKeys = Object.keys(this.orca.variables);
		if (varKeys.length > 0) {
			this.write(varKeys.join(''), offsetX + gridSize * 4, interfaceY, gridSize - 1, 'f_high');
		}
	}

	drawGuide(): void {
		if (!this.ctx) return;

		// Get all operator keys (excluding numbers)
		const operators = Object.keys(this.orca.getLibrary()).filter((val) => isNaN(Number(val)));
		const frame = this.orca.h - 4;

		for (let id = 0; id < operators.length; id++) {
			const key = operators[id];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const OpClass = this.orca.getLibrary()[key] as any;
			if (!OpClass) continue;

			// Create a temporary instance to get info
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const tempOp = new OpClass(this.orca, 0, 0, key, false) as any;
			const text = tempOp.info || tempOp.name;

			const x = Math.floor(id / frame) * 32 + 2;
			const y = (id % frame) + 2;

			this.write(key, x, y, 99, 'b_high');
			this.write(text, x + 2, y, 99, 'f_low');
		}
	}

	render(
		cursorX: number,
		cursorY: number,
		isPaused: boolean,
		showInterface: boolean = false,
		showGuide: boolean = false,
		selection?: { x: number; y: number; w: number; h: number }
	): void {
		// Update ports map
		this.findPorts();

		// Set canvas dimensions (interface uses the last row, no extra rows needed)
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

		// Calculate selection bounds
		let selMinX = cursorX,
			selMinY = cursorY,
			selMaxX = cursorX,
			selMaxY = cursorY;
		if (selection && (selection.w !== 0 || selection.h !== 0)) {
			selMinX = selection.x < selection.x + selection.w ? selection.x : selection.x + selection.w;
			selMinY = selection.y < selection.y + selection.h ? selection.y : selection.y + selection.h;
			selMaxX = selection.x > selection.x + selection.w ? selection.x : selection.x + selection.w;
			selMaxY = selection.y > selection.y + selection.h ? selection.y : selection.y + selection.h;
		}

		// Draw grid
		for (let y = 0; y < this.orca.h; y++) {
			for (let x = 0; x < this.orca.w; x++) {
				const glyph = this.orca.glyphAt(x, y);
				const isCursor = x === cursorX && y === cursorY;
				const isLocked = this.orca.lockAt(x, y);
				const port = this.ports[this.orca.indexAt(x, y)];
				const isSelected =
					selection &&
					(selection.w !== 0 || selection.h !== 0) &&
					x >= selMinX &&
					x <= selMaxX &&
					y >= selMinY &&
					y <= selMaxY;

				// Skip invisible cells (but not selected cells - they should always show)
				if (!isSelected && !isCursor && this.isInvisible(x, y, cursorX, cursorY)) {
					continue;
				}

				this.drawSprite(
					x,
					y,
					glyph,
					isCursor,
					isLocked,
					isPaused,
					port,
					cursorX,
					cursorY,
					isSelected
				);
			}
		}

		// Draw optional overlays
		if (showGuide) {
			this.drawGuide();
		}
		if (showInterface) {
			const selW = selection ? selection.w : 0;
			const selH = selection ? selection.h : 0;
			this.drawInterface(cursorX, cursorY, isPaused, selW, selH);
		}
	}

	private drawSprite(
		x: number,
		y: number,
		glyph: string,
		isCursor: boolean,
		isLocked: boolean,
		isPaused: boolean,
		port?: [number, number, number, string],
		cursorX?: number,
		cursorY?: number,
		isSelected?: boolean
	): void {
		// Determine what to display
		let displayGlyph = glyph;
		if (glyph === '.') {
			if (isCursor) {
				displayGlyph = isPaused ? '~' : '@';
			} else if (isSelected) {
				// Show dot in selected cells (matching original Orca)
				displayGlyph = '.';
			} else if (this.isMarker(x, y)) {
				displayGlyph = '+';
			} else if (
				cursorX !== undefined &&
				cursorY !== undefined &&
				this.isLocals(x, y, cursorX, cursorY)
			) {
				displayGlyph = '·'; // Middle dot for local markers
			}
		}

		const theme = this.makeTheme(glyph, isCursor, isLocked, port, isSelected);

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
		port?: [number, number, number, string],
		isSelected?: boolean
	): { bg?: string; fg?: string } {
		// Cursor (selected)
		if (isCursor) {
			return { bg: this.colors.b_inv, fg: this.colors.f_inv };
		}

		// Multi-cell selection highlighting (orange background with black text)
		if (isSelected) {
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

	updateCanvasScale(canvasScale: number): void {
		this.scale = canvasScale > 0 ? canvasScale : 1;
		this.tileWS = Math.floor(this.tileW * this.scale);
		this.tileHS = Math.floor(this.tileH * this.scale);
	}
}
