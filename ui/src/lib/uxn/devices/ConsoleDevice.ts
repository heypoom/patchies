// Console device - I/O with vector callbacks
// Ported from uxn5/src/devices/console.js

import { logger } from '$lib/utils/logger';
import type { UxnEmulator } from '../UxnEmulator';

export interface ConsoleOutputCallback {
  (output: string, isError: boolean): void;
}

export class ConsoleDevice {
  private emu: UxnEmulator;
  public vector: number = 0;
  private onOutput?: ConsoleOutputCallback;

  constructor(emu: UxnEmulator, onOutput?: ConsoleOutputCallback) {
    this.emu = emu;
    this.onOutput = onOutput;
  }

  start(): void {
    // No DOM initialization needed for Patchies
  }

  input(char: number, type: number): void {
    this.emu.uxn.dev[0x12] = char;
    this.emu.uxn.dev[0x17] = type;
    if (this.vector) {
      this.emu.uxn.eval(this.vector);
    }
  }

  set_vector(hb: number, lb: number): void {
    this.vector = (hb << 8) | lb;
  }

  write(char: number): void {
    const output = String.fromCharCode(char);
    if (this.onOutput) {
      this.onOutput(output, false);
    } else {
      logger.log(output);
    }
  }

  error(char: number): void {
    const output = String.fromCharCode(char);

    if (this.onOutput) {
      this.onOutput(output, true);
    } else {
      logger.error(output);
    }
  }

  debug(byte: number): void {
    const output = byte.toString(16);

    if (this.onOutput) {
      this.onOutput(output, true);
    } else {
      logger.debug(output);
    }
  }

  deo(addr: number): void {
    switch (addr) {
      case 0x10:
      case 0x11:
        this.set_vector(this.emu.uxn.dev[0x10], this.emu.uxn.dev[0x11]);
        break;
      case 0x18:
        this.write(this.emu.uxn.dev[0x18]);
        break;
      case 0x19:
        this.error(this.emu.uxn.dev[0x19]);
        break;
      case 0x1a:
        this.debug(this.emu.uxn.dev[0x1a]);
        break;
      case 0x1b:
        this.debug(this.emu.uxn.dev[0x1b]);
        break;
    }
  }
}
