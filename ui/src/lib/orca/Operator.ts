/**
 * Operator Base Class
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript integration
 */

import type { Orca } from './Orca';

export interface Port {
	x: number;
	y: number;
	clamp?: { min?: number; max?: number };
	default?: string;
	output?: boolean;
	bang?: boolean;
	reader?: boolean;
	sensitive?: boolean;
}

export class Operator {
	name: string;
	x: number;
	y: number;
	passive: boolean;
	draw: boolean;
	glyph: string;
	info: string;
	ports: Record<string, Port>;

	protected orca: Orca;

	constructor(orca: Orca, x: number, y: number, glyph: string = '.', passive: boolean = false) {
		this.orca = orca;
		this.name = 'unknown';
		this.x = x;
		this.y = y;
		this.passive = passive;
		this.draw = passive;
		this.glyph = passive ? glyph.toUpperCase() : glyph;
		this.info = '--';
		this.ports = {};
	}

	// Actions

	listen(port: Port | undefined, toValue: boolean = false): string | number {
		if (!port) return toValue ? 0 : '.';

		const g = this.orca.glyphAt(this.x + port.x, this.y + port.y);
		const glyph = (g === '.' || g === '*') && port.default ? port.default : g;

		if (toValue) {
			const min = port.clamp && port.clamp.min ? port.clamp.min : 0;
			const max = port.clamp && port.clamp.max ? port.clamp.max : 36;
			return clamp(this.orca.valueOf(glyph), min, max);
		}
		return glyph;
	}

	output(g: string, port?: Port): void {
		const outputPort = port || this.ports.output;
		if (!outputPort) {
			console.warn(this.name, 'Trying to output, but no port');
			return;
		}
		if (!g) return;
		this.orca.write(
			this.x + outputPort.x,
			this.y + outputPort.y,
			this.shouldUpperCase() === true ? `${g}`.toUpperCase() : g
		);
	}

	bang(b: boolean): void {
		if (!this.ports.output) {
			console.warn(this.name, 'Trying to bang, but no port');
			return;
		}
		this.orca.write(this.x + this.ports.output.x, this.y + this.ports.output.y, b ? '*' : '.');
		this.orca.lock(this.x + this.ports.output.x, this.y + this.ports.output.y);
	}

	// Phases

	run(force: boolean = false): void {
		// Operate
		const payload = this.operation(force);

		// Permissions
		for (const port of Object.values(this.ports)) {
			if (port.bang) continue;
			this.orca.lock(this.x + port.x, this.y + port.y);
		}

		if (this.ports.output) {
			if (this.ports.output.bang === true) {
				this.bang(!!payload);
			} else {
				this.output(String(payload));
			}
		}
	}

	operation(force?: boolean): any {
		// Override in subclasses
	}

	// Helpers

	lock(): void {
		this.orca.lock(this.x, this.y);
	}

	replace(g: string): void {
		this.orca.write(this.x, this.y, g);
	}

	erase(): void {
		this.replace('.');
	}

	explode(): void {
		this.replace('*');
	}

	move(x: number, y: number): void {
		const offset = { x: this.x + x, y: this.y + y };
		if (!this.orca.inBounds(offset.x, offset.y)) {
			this.explode();
			return;
		}
		if (this.orca.glyphAt(offset.x, offset.y) !== '.') {
			this.explode();
			return;
		}
		this.erase();
		this.x += x;
		this.y += y;
		this.replace(this.glyph);
		this.lock();
	}

	hasNeighbor(g: string): boolean {
		if (this.orca.glyphAt(this.x + 1, this.y) === g) return true;
		if (this.orca.glyphAt(this.x - 1, this.y) === g) return true;
		if (this.orca.glyphAt(this.x, this.y + 1) === g) return true;
		if (this.orca.glyphAt(this.x, this.y - 1) === g) return true;
		return false;
	}

	// Docs

	addPort(name: string, pos: Port): void {
		this.ports[name] = pos;
	}

	getPorts(): Array<[number, number, number, string]> {
		const a: Array<[number, number, number, string]> = [];
		if (this.draw === true) {
			a.push([
				this.x,
				this.y,
				0,
				`${this.name.charAt(0).toUpperCase() + this.name.substring(1).toLowerCase()}`
			]);
		}
		if (!this.passive) return a;

		for (const id in this.ports) {
			const port = this.ports[id];
			const type = port.output ? 3 : port.x < 0 || port.y < 0 ? 1 : 2;
			a.push([this.x + port.x, this.y + port.y, type, `${this.glyph}-${id}`]);
		}
		return a;
	}

	shouldUpperCase(ports: Record<string, Port> = this.ports): boolean {
		if (!this.ports.output || !this.ports.output.sensitive) return false;
		const value = this.listen({ x: 1, y: 0 });
		if (typeof value === 'number') return false;
		if (value.toLowerCase() === value.toUpperCase()) return false;
		if (value.toUpperCase() !== value) return false;
		return true;
	}
}

function clamp(v: number, min: number, max: number): number {
	return v < min ? min : v > max ? max : v;
}
