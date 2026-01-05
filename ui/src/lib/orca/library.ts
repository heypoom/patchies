/**
 * Orca Operator Library
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript integration
 */

import { Operator } from './Operator';
import type { Orca } from './Orca';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const library: Record<string, any> = {};

// A - Add
library.a = class OperatorA extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'a', passive);
		this.name = 'add';
		this.info = 'Outputs sum of inputs';
		this.ports.a = { x: -1, y: 0 };
		this.ports.b = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, output: true };
	}

	operation(): string {
		const a = this.listen(this.ports.a, true) as number;
		const b = this.listen(this.ports.b, true) as number;
		return this.orca.keyOf(a + b);
	}
};

// B - Subtract
library.b = class OperatorB extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'b', passive);
		this.name = 'subtract';
		this.info = 'Outputs difference of inputs';
		this.ports.a = { x: -1, y: 0 };
		this.ports.b = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, output: true };
	}

	operation(): string {
		const a = this.listen(this.ports.a, true) as number;
		const b = this.listen(this.ports.b, true) as number;
		return this.orca.keyOf(Math.abs(b - a));
	}
};

// C - Clock
library.c = class OperatorC extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'c', passive);
		this.name = 'clock';
		this.info = 'Outputs modulo of frame';
		this.ports.rate = { x: -1, y: 0, clamp: { min: 1 } };
		this.ports.mod = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, output: true };
	}

	operation(): string {
		const rate = this.listen(this.ports.rate, true) as number;
		const mod = this.listen(this.ports.mod, true) as number;
		const val = Math.floor(this.orca.f / rate) % mod;
		return this.orca.keyOf(val);
	}
};

// D - Delay
library.d = class OperatorD extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'd', passive);
		this.name = 'delay';
		this.info = 'Bangs on modulo of frame';
		this.ports.rate = { x: -1, y: 0, clamp: { min: 1 } };
		this.ports.mod = { x: 1, y: 0, clamp: { min: 1 } };
		this.ports.output = { x: 0, y: 1, bang: true, output: true };
	}

	operation(): boolean {
		const rate = this.listen(this.ports.rate, true) as number;
		const mod = this.listen(this.ports.mod, true) as number;
		const res = this.orca.f % (mod * rate);
		return res === 0 || mod === 1;
	}
};

// E - East
library.e = class OperatorE extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'e', passive);
		this.name = 'east';
		this.info = 'Moves eastward, or bangs';
		this.draw = false;
	}

	operation(): void {
		this.move(1, 0);
		this.passive = false;
	}
};

// F - If
library.f = class OperatorF extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'f', passive);
		this.name = 'if';
		this.info = 'Bangs if inputs are equal';
		this.ports.a = { x: -1, y: 0 };
		this.ports.b = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, bang: true, output: true };
	}

	operation(): boolean {
		const a = this.listen(this.ports.a);
		const b = this.listen(this.ports.b);
		return a === b;
	}
};

// G - Generator
library.g = class OperatorG extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'g', passive);
		this.name = 'generator';
		this.info = 'Writes operands with offset';
		this.ports.x = { x: -3, y: 0 };
		this.ports.y = { x: -2, y: 0 };
		this.ports.len = { x: -1, y: 0, clamp: { min: 1 } };
	}

	operation(): void {
		const len = this.listen(this.ports.len, true) as number;
		const x = this.listen(this.ports.x, true) as number;
		const y = (this.listen(this.ports.y, true) as number) + 1;
		for (let offset = 0; offset < len; offset++) {
			const inPort = { x: offset + 1, y: 0 };
			const outPort = { x: x + offset, y: y, output: true };
			this.addPort(`in${offset}`, inPort);
			this.addPort(`out${offset}`, outPort);
			const res = this.listen(inPort);
			this.output(`${res}`, outPort);
		}
	}
};

// H - Halt
library.h = class OperatorH extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'h', passive);
		this.name = 'halt';
		this.info = 'Halts southward operand';
		this.ports.output = { x: 0, y: 1, reader: true, output: true };
	}

	operation(): number {
		this.orca.lock(this.x + this.ports.output.x, this.y + this.ports.output.y);
		return this.listen(this.ports.output, true) as number;
	}
};

// I - Increment
library.i = class OperatorI extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'i', passive);
		this.name = 'increment';
		this.info = 'Increments southward operand';
		this.ports.step = { x: -1, y: 0 };
		this.ports.mod = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, reader: true, output: true };
	}

	operation(): string {
		const step = this.listen(this.ports.step, true) as number;
		const mod = this.listen(this.ports.mod, true) as number;
		const val = this.listen(this.ports.output, true) as number;
		return mod ? this.orca.keyOf((val + step) % mod) : '0';
	}
};

// J - Jumper
library.j = class OperatorJ extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'j', passive);
		this.name = 'jumper';
		this.info = 'Outputs northward operand';
	}

	operation(): string {
		const val = this.listen({ x: 0, y: -1 });
		if (val !== 'J') {
			let i = 0;
			while (this.orca.inBounds(this.x, this.y + i)) {
				if (this.listen({ x: 0, y: ++i }) !== this.glyph) break;
			}
			this.addPort('input', { x: 0, y: -1 });
			this.addPort('output', { x: 0, y: i, output: true });
			return val as string;
		}
		return '';
	}
};

// K - Konkat
library.k = class OperatorK extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'k', passive);
		this.name = 'konkat';
		this.info = 'Reads multiple variables';
		this.ports.len = { x: -1, y: 0, clamp: { min: 1 } };
	}

	operation(): void {
		const len = this.listen(this.ports.len, true) as number;
		for (let offset = 0; offset < len; offset++) {
			const key = this.orca.glyphAt(this.x + offset + 1, this.y);
			this.orca.lock(this.x + offset + 1, this.y);
			if (key === '.') continue;
			const inPort = { x: offset + 1, y: 0 };
			const outPort = { x: offset + 1, y: 1, output: true };
			this.addPort(`in${offset}`, inPort);
			this.addPort(`out${offset}`, outPort);
			const res = this.orca.valueIn(key);
			this.output(`${res}`, outPort);
		}
	}
};

// L - Lesser
library.l = class OperatorL extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'l', passive);
		this.name = 'lesser';
		this.info = 'Outputs smallest input';
		this.ports.a = { x: -1, y: 0 };
		this.ports.b = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, output: true };
	}

	operation(): string {
		const a = this.listen(this.ports.a, true) as number;
		const b = this.listen(this.ports.b, true) as number;
		return this.orca.keyOf(a > b ? b : a);
	}
};

// M - Multiply
library.m = class OperatorM extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'm', passive);
		this.name = 'multiply';
		this.info = 'Outputs product of inputs';
		this.ports.a = { x: -1, y: 0 };
		this.ports.b = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, output: true };
	}

	operation(): string {
		const a = this.listen(this.ports.a, true) as number;
		const b = this.listen(this.ports.b, true) as number;
		return this.orca.keyOf(a * b);
	}
};

// N - North
library.n = class OperatorN extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'n', passive);
		this.name = 'north';
		this.info = 'Moves northward, or bangs';
		this.draw = false;
	}

	operation(): void {
		this.move(0, -1);
		this.passive = false;
	}
};

// O - Read
library.o = class OperatorO extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'o', passive);
		this.name = 'read';
		this.info = 'Reads operand with offset';
		this.ports.x = { x: -2, y: 0 };
		this.ports.y = { x: -1, y: 0 };
		this.ports.output = { x: 0, y: 1, output: true };
	}

	operation(): string {
		const x = this.listen(this.ports.x, true) as number;
		const y = this.listen(this.ports.y, true) as number;
		this.addPort('read', { x: x + 1, y: y });
		return this.listen(this.ports.read) as string;
	}
};

// P - Push
library.p = class OperatorP extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'p', passive);
		this.name = 'push';
		this.info = 'Writes eastward operand';
		this.ports.key = { x: -2, y: 0 };
		this.ports.len = { x: -1, y: 0, clamp: { min: 1 } };
		this.ports.val = { x: 1, y: 0 };
	}

	operation(): string {
		const len = this.listen(this.ports.len, true) as number;
		const key = this.listen(this.ports.key, true) as number;
		for (let offset = 0; offset < len; offset++) {
			this.orca.lock(this.x + offset, this.y + 1);
		}
		this.ports.output = { x: key % len, y: 1, output: true };
		return this.listen(this.ports.val) as string;
	}
};

// Q - Query
library.q = class OperatorQ extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'q', passive);
		this.name = 'query';
		this.info = 'Reads operands with offset';
		this.ports.x = { x: -3, y: 0 };
		this.ports.y = { x: -2, y: 0 };
		this.ports.len = { x: -1, y: 0, clamp: { min: 1 } };
	}

	operation(): void {
		const len = this.listen(this.ports.len, true) as number;
		const x = this.listen(this.ports.x, true) as number;
		const y = this.listen(this.ports.y, true) as number;
		for (let offset = 0; offset < len; offset++) {
			const inPort = { x: x + offset + 1, y: y };
			const outPort = { x: offset - len + 1, y: 1, output: true };
			this.addPort(`in${offset}`, inPort);
			this.addPort(`out${offset}`, outPort);
			const res = this.listen(inPort);
			this.output(`${res}`, outPort);
		}
	}
};

// R - Random
library.r = class OperatorR extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'r', passive);
		this.name = 'random';
		this.info = 'Outputs random value';
		this.ports.a = { x: -1, y: 0 };
		this.ports.b = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, output: true };
	}

	operation(): string {
		const a = this.listen(this.ports.a, true) as number;
		const b = this.listen(this.ports.b, true) as number;
		if (a === b) return this.orca.keyOf(a);
		if (a > b) return this.orca.keyOf(Math.floor(Math.random() * (a - b + 1) + b));
		return this.orca.keyOf(Math.floor(Math.random() * (b - a + 1) + a));
	}
};

// S - South
library.s = class OperatorS extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 's', passive);
		this.name = 'south';
		this.info = 'Moves southward, or bangs';
		this.draw = false;
	}

	operation(): void {
		this.move(0, 1);
		this.passive = false;
	}
};

// T - Track
library.t = class OperatorT extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 't', passive);
		this.name = 'track';
		this.info = 'Reads eastward operand';
		this.ports.key = { x: -2, y: 0 };
		this.ports.len = { x: -1, y: 0, clamp: { min: 1 } };
		this.ports.output = { x: 0, y: 1, output: true };
	}

	operation(): string {
		const len = this.listen(this.ports.len, true) as number;
		const key = this.listen(this.ports.key, true) as number;
		for (let offset = 0; offset < len; offset++) {
			this.orca.lock(this.x + offset + 1, this.y);
		}
		this.ports.val = { x: (key % len) + 1, y: 0 };
		return this.listen(this.ports.val) as string;
	}
};

// U - Uclid (Euclidean Rhythm)
library.u = class OperatorU extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'u', passive);
		this.name = 'uclid';
		this.info = 'Bangs on Euclidean rhythm';
		this.ports.step = { x: -1, y: 0, clamp: { min: 0 } };
		this.ports.max = { x: 1, y: 0, clamp: { min: 1 } };
		this.ports.output = { x: 0, y: 1, bang: true, output: true };
	}

	operation(): boolean {
		const step = this.listen(this.ports.step, true) as number;
		const max = this.listen(this.ports.max, true) as number;
		const bucket = ((step * (this.orca.f + max - 1)) % max) + step;
		return bucket >= max;
	}
};

// V - Variable
library.v = class OperatorV extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'v', passive);
		this.name = 'variable';
		this.info = 'Reads and writes variable';
		this.ports.write = { x: -1, y: 0 };
		this.ports.read = { x: 1, y: 0 };
	}

	operation(): string | void {
		const write = this.listen(this.ports.write);
		const read = this.listen(this.ports.read);
		if (write === '.' && read !== '.') {
			this.addPort('output', { x: 0, y: 1, output: true });
		}
		if (write !== '.') {
			this.orca.variables[write as string] = read as string;
			return;
		}
		return this.orca.valueIn(read as string);
	}
};

// W - West
library.w = class OperatorW extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'w', passive);
		this.name = 'west';
		this.info = 'Moves westward, or bangs';
		this.draw = false;
	}

	operation(): void {
		this.move(-1, 0);
		this.passive = false;
	}
};

// X - Write
library.x = class OperatorX extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'x', passive);
		this.name = 'write';
		this.info = 'Writes operand with offset';
		this.ports.x = { x: -2, y: 0 };
		this.ports.y = { x: -1, y: 0 };
		this.ports.val = { x: 1, y: 0 };
	}

	operation(): string {
		const x = this.listen(this.ports.x, true) as number;
		const y = (this.listen(this.ports.y, true) as number) + 1;
		this.addPort('output', { x: x, y: y, output: true });
		return this.listen(this.ports.val) as string;
	}
};

// Y - Jymper
library.y = class OperatorY extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'y', passive);
		this.name = 'jymper';
		this.info = 'Outputs westward operand';
	}

	operation(): string {
		const val = this.listen({ x: -1, y: 0, output: true });
		if (val !== 'Y') {
			let i = 0;
			while (this.orca.inBounds(this.x + i, this.y)) {
				if (this.listen({ x: ++i, y: 0 }) !== this.glyph) break;
			}
			this.addPort('input', { x: -1, y: 0 });
			this.addPort('output', { x: i, y: 0, output: true });
			return val as string;
		}
		return '';
	}
};

// Z - Lerp
library.z = class OperatorZ extends Operator {
	constructor(orca: Orca, x: number, y: number, passive: boolean) {
		super(orca, x, y, 'z', passive);
		this.name = 'lerp';
		this.info = 'Transitions operand to target';
		this.ports.rate = { x: -1, y: 0 };
		this.ports.target = { x: 1, y: 0 };
		this.ports.output = { x: 0, y: 1, sensitive: true, reader: true, output: true };
	}

	operation(): string {
		const rate = this.listen(this.ports.rate, true) as number;
		const target = this.listen(this.ports.target, true) as number;
		const val = this.listen(this.ports.output, true) as number;
		const mod = val <= target - rate ? rate : val >= target + rate ? -rate : target - val;
		return this.orca.keyOf(val + mod);
	}
};

// Specials

// * - Bang
library['*'] = class OperatorBang extends Operator {
	constructor(orca: Orca, x: number, y: number) {
		super(orca, x, y, '*', true);
		this.name = 'bang';
		this.info = 'Bangs neighboring operands';
		this.draw = false;
	}

	run(): void {
		this.draw = false;
		this.erase();
	}
};

// # - Comment
library['#'] = class OperatorComment extends Operator {
	constructor(orca: Orca, x: number, y: number) {
		super(orca, x, y, '#', true);
		this.name = 'comment';
		this.info = 'Halts line';
		this.draw = false;
	}

	operation(): void {
		for (let x = this.x + 1; x <= this.orca.w; x++) {
			this.orca.lock(x, this.y);
			if (this.orca.glyphAt(x, this.y) === this.glyph) break;
		}
		this.orca.lock(this.x, this.y);
	}
};

// Numbers (0-9) - Null operators
for (let i = 0; i <= 9; i++) {
	library[`${i}`] = class OperatorNull extends Operator {
		constructor(orca: Orca, x: number, y: number) {
			super(orca, x, y, '.', false);
			this.name = 'null';
			this.info = 'empty';
		}

		run(): void {
			// No operation
		}
	};
}

// IO Operators

// : - MIDI
library[':'] = class OperatorMidi extends Operator {
	constructor(orca: Orca, x: number, y: number) {
		super(orca, x, y, ':', true);
		this.name = 'midi';
		this.info = 'Sends MIDI note';
		this.ports.channel = { x: 1, y: 0 };
		this.ports.octave = { x: 2, y: 0, clamp: { min: 0, max: 8 } };
		this.ports.note = { x: 3, y: 0 };
		this.ports.velocity = { x: 4, y: 0, default: 'f', clamp: { min: 0, max: 16 } };
		this.ports.length = { x: 5, y: 0, default: '1', clamp: { min: 0, max: 32 } };
	}

	operation(force: boolean = false): void {
		if (!this.hasNeighbor('*') && force === false) return;
		if (this.listen(this.ports.channel) === '.') return;
		if (this.listen(this.ports.octave) === '.') return;
		const noteValue = this.listen(this.ports.note);
		if (noteValue === '.') return;
		if (typeof noteValue === 'number' || !isNaN(Number(noteValue))) return;

		const channel = this.listen(this.ports.channel, true) as number;
		if (channel > 15) return;
		const octave = this.listen(this.ports.octave, true) as number;
		const note = noteValue as string;
		const velocity = this.listen(this.ports.velocity, true) as number;
		const length = this.listen(this.ports.length, true) as number;

		if (this.orca.io) {
			this.orca.io.midi.push(channel, octave, note, velocity, length);
		}

		this.draw = false;
	}
};

// % - Mono
library['%'] = class OperatorMono extends Operator {
	constructor(orca: Orca, x: number, y: number) {
		super(orca, x, y, '%', true);
		this.name = 'mono';
		this.info = 'Sends MIDI monophonic note';
		this.ports.channel = { x: 1, y: 0 };
		this.ports.octave = { x: 2, y: 0, clamp: { min: 0, max: 8 } };
		this.ports.note = { x: 3, y: 0 };
		this.ports.velocity = { x: 4, y: 0, default: 'f', clamp: { min: 0, max: 16 } };
		this.ports.length = { x: 5, y: 0, default: '1', clamp: { min: 0, max: 32 } };
	}

	operation(force: boolean = false): void {
		if (!this.hasNeighbor('*') && force === false) return;
		if (this.listen(this.ports.channel) === '.') return;
		if (this.listen(this.ports.octave) === '.') return;
		const noteValue = this.listen(this.ports.note);
		if (noteValue === '.') return;
		if (typeof noteValue === 'number' || !isNaN(Number(noteValue))) return;

		const channel = this.listen(this.ports.channel, true) as number;
		if (channel > 15) return;
		const octave = this.listen(this.ports.octave, true) as number;
		const note = noteValue as string;
		const velocity = this.listen(this.ports.velocity, true) as number;
		const length = this.listen(this.ports.length, true) as number;

		if (this.orca.io) {
			this.orca.io.mono.push(channel, octave, note, velocity, length);
		}

		this.draw = false;
	}
};

// ! - CC (Control Change)
library['!'] = class OperatorCC extends Operator {
	constructor(orca: Orca, x: number, y: number) {
		super(orca, x, y, '!', true);
		this.name = 'cc';
		this.info = 'Sends MIDI control change';
		this.ports.channel = { x: 1, y: 0 };
		this.ports.knob = { x: 2, y: 0, clamp: { min: 0 } };
		this.ports.value = { x: 3, y: 0, clamp: { min: 0 } };
	}

	operation(force: boolean = false): void {
		if (!this.hasNeighbor('*') && force === false) return;
		if (this.listen(this.ports.channel) === '.') return;
		if (this.listen(this.ports.knob) === '.') return;

		const channel = this.listen(this.ports.channel, true) as number;
		if (channel > 15) return;
		const knob = this.listen(this.ports.knob, true) as number;
		const rawValue = this.listen(this.ports.value, true) as number;
		const value = Math.ceil((127 * rawValue) / 35);

		if (this.orca.io) {
			this.orca.io.cc.stack.push({ channel, knob, value, type: 'cc' });
		}

		this.draw = false;
	}
};

// ? - PB (Pitch Bend)
library['?'] = class OperatorPB extends Operator {
	constructor(orca: Orca, x: number, y: number) {
		super(orca, x, y, '?', true);
		this.name = 'pb';
		this.info = 'Sends MIDI pitch bend';
		this.ports.channel = { x: 1, y: 0, clamp: { min: 0, max: 15 } };
		this.ports.lsb = { x: 2, y: 0, clamp: { min: 0 } };
		this.ports.msb = { x: 3, y: 0, clamp: { min: 0 } };
	}

	operation(force: boolean = false): void {
		if (!this.hasNeighbor('*') && force === false) return;
		if (this.listen(this.ports.channel) === '.') return;
		if (this.listen(this.ports.lsb) === '.') return;

		const channel = this.listen(this.ports.channel, true) as number;
		const rawLsb = this.listen(this.ports.lsb, true) as number;
		const lsb = Math.ceil((127 * rawLsb) / 35);
		const rawMsb = this.listen(this.ports.msb, true) as number;
		const msb = Math.ceil((127 * rawMsb) / 35);

		if (this.orca.io) {
			this.orca.io.cc.stack.push({ channel, lsb, msb, type: 'pb' });
		}

		this.draw = false;
	}
};
