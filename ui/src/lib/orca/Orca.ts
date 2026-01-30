/**
 * Orca - Esoteric Programming Language
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript integration
 */

import type { Operator } from './Operator';
import type { IO } from './io/IO';

export class Orca {
  keys = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');

  w: number; // Width
  h: number; // Height
  f: number; // Frame
  s: string; // Grid string (single string, not 2D array)

  locks: boolean[];
  runtime: Operator[];
  variables: Record<string, string>;
  io: IO | null = null; // IO instance, set after initialization

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private library: Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getLibrary(): Record<string, any> {
    return this.library;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(library: Record<string, any>) {
    this.library = library;
    this.w = 1;
    this.h = 1;
    this.f = 0;
    this.s = '';
    this.locks = [];
    this.runtime = [];
    this.variables = {};
    this.reset();
  }

  run(): void {
    this.runtime = this.parse();
    this.operate(this.runtime);
    this.f += 1;
  }

  reset(w: number = this.w, h: number = this.h): void {
    this.f = 0;
    this.w = w;
    this.h = h;
    this.replace(new Array(this.h * this.w + 1).join('.'));
  }

  load(w: number, h: number, s: string, f: number = 0): Orca {
    this.w = w;
    this.h = h;
    this.f = f;
    this.replace(this.clean(s));
    return this;
  }

  write(x: number, y: number, g: string): boolean {
    if (!g) return false;
    if (g.length !== 1) return false;
    if (!this.inBounds(x, y)) return false;
    if (this.glyphAt(x, y) === g) return false;

    const index = this.indexAt(x, y);
    const glyph = !this.isAllowed(g) ? '.' : g;
    const string = this.s.substring(0, index) + glyph + this.s.substring(index + 1);
    this.replace(string);
    return true;
  }

  clean(str: string): string {
    return `${str}`
      .replace(/\n/g, '')
      .trim()
      .substring(0, this.w * this.h)
      .split('')
      .map((g) => {
        return !this.isAllowed(g) ? '.' : g;
      })
      .join('');
  }

  replace(s: string): void {
    this.s = s;
  }

  // Operators

  parse(): Operator[] {
    const a: Operator[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const g = this.glyphAt(x, y);
        if (g === '.' || !this.isAllowed(g)) continue;
        const OpClass = this.library[g.toLowerCase()];
        if (OpClass) {
          // Uppercase = passive (runs when banged), lowercase = active (runs every frame)
          const isPassive = g === g.toUpperCase() && g.toLowerCase() !== g.toUpperCase();
          a.push(new OpClass(this, x, y, isPassive) as Operator);
        }
      }
    }
    return a;
  }

  operate(operators: Operator[]): void {
    this.release();
    for (const operator of operators) {
      if (this.lockAt(operator.x, operator.y)) continue;
      if (operator.passive || operator.hasNeighbor('*')) {
        operator.run();
      }
    }
  }

  bounds(): { w: number; h: number } {
    let w = 0;
    let h = 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const g = this.glyphAt(x, y);
        if (g !== '.') {
          if (x > w) w = x;
          if (y > h) h = y;
        }
      }
    }
    return { w, h };
  }

  // Blocks

  getBlock(x: number, y: number, w: number, h: number): string {
    let lines = '';
    for (let _y = y; _y < y + h; _y++) {
      let line = '';
      for (let _x = x; _x < x + w; _x++) {
        line += this.glyphAt(_x, _y);
      }
      lines += line + '\n';
    }
    return lines;
  }

  writeBlock(x: number, y: number, block: string, overlap: boolean = false): void {
    if (!block) return;
    const lines = block.split(/\r?\n/);
    let _y = y;
    for (const line of lines) {
      let _x = x;
      for (let i = 0; i < line.length; i++) {
        const glyph = line[i];
        this.write(_x, _y, overlap === true && glyph === '.' ? this.glyphAt(_x, _y) : glyph);
        _x++;
      }
      _y++;
    }
  }

  // Locks

  release(): void {
    this.locks = new Array(this.w * this.h);
    this.variables = {};
  }

  unlock(x: number, y: number): void {
    this.locks[this.indexAt(x, y)] = false;
  }

  lock(x: number, y: number): void {
    if (this.lockAt(x, y)) return;
    this.locks[this.indexAt(x, y)] = true;
  }

  // Helpers

  inBounds(x: number, y: number): boolean {
    return (
      Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < this.w && y >= 0 && y < this.h
    );
  }

  isAllowed(g: string): boolean {
    return g === '.' || !!this.library[`${g}`.toLowerCase()];
  }

  isSpecial(g: string): boolean {
    return g.toLowerCase() === g.toUpperCase() && isNaN(Number(g));
  }

  keyOf(val: number, uc: boolean = false): string {
    return uc === true ? this.keys[val % 36].toUpperCase() : this.keys[val % 36];
  }

  valueOf(g: string): number {
    return !g || g === '.' || g === '*' ? 0 : this.keys.indexOf(`${g}`.toLowerCase());
  }

  indexAt(x: number, y: number): number {
    return this.inBounds(x, y) === true ? x + this.w * y : -1;
  }

  operatorAt(x: number, y: number): Operator | undefined {
    return this.runtime.find((item) => item.x === x && item.y === y);
  }

  posAt(index: number): { x: number; y: number } {
    return { x: index % this.w, y: Math.floor(index / this.w) };
  }

  glyphAt(x: number, y: number): string {
    return this.s.charAt(this.indexAt(x, y));
  }

  valueAt(x: number, y: number): number {
    return this.valueOf(this.glyphAt(x, y));
  }

  lockAt(x: number, y: number): boolean {
    return this.locks[this.indexAt(x, y)] === true;
  }

  valueIn(key: string): string {
    return this.variables[key] || '.';
  }

  // Tools

  format(): string {
    const a: string[] = [];
    for (let y = 0; y < this.h; y++) {
      a.push(this.s.substring(y * this.w, (y + 1) * this.w));
    }
    return a.reduce((acc, val) => {
      return `${acc}${val}\n`;
    }, '');
  }

  length(): number {
    return this.strip().length;
  }

  strip(): string {
    return this.s.replace(/[^a-zA-Z0-9+]+/gi, '').trim();
  }

  toString(): string {
    return this.format().trim();
  }

  toRect(str: string = this.s): { x: number; y: number } {
    const lines = str.trim().split(/\r?\n/);
    return { x: lines[0].length, y: lines.length };
  }
}
