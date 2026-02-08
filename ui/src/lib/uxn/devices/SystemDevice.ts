// System device - palette, expansion, halt
// Ported from uxn5/src/devices/system.js

import { peek16 } from '../utils';
import type { UxnEmulator } from '../UxnEmulator';

export class SystemDevice {
  private emu: UxnEmulator;

  constructor(emu: UxnEmulator) {
    this.emu = emu;
  }

  private expansion(addr: number): void {
    if (!this.emu.uxn) return;

    const operation = this.emu.uxn.ram[addr];
    const length = peek16(this.emu.uxn.ram, addr + 1);
    // fill
    if (operation == 0) {
      const dst_page = peek16(this.emu.uxn.ram, addr + 3);
      const dst_addr = peek16(this.emu.uxn.ram, addr + 5);
      const value = this.emu.uxn.ram[addr + 7];
      const dst = dst_page * 0x10000;
      for (let i = 0; i < length; i++) {
        this.emu.uxn.ram[dst + ((dst_addr + i) & 0xffff)] = value;
      }
    }
    // cpyl
    else if (operation == 1) {
      const a = peek16(this.emu.uxn.ram, addr + 3) * 0x10000 + peek16(this.emu.uxn.ram, addr + 5);
      const b = a + length;
      let c = peek16(this.emu.uxn.ram, addr + 7) * 0x10000 + peek16(this.emu.uxn.ram, addr + 9);
      for (let i = a; i < b; i++) {
        this.emu.uxn.ram[c++] = this.emu.uxn.ram[i];
      }
    }
    // cpyr
    else if (operation == 2) {
      const src_page = peek16(this.emu.uxn.ram, addr + 3);
      const src_addr = peek16(this.emu.uxn.ram, addr + 5);
      const dst_page = peek16(this.emu.uxn.ram, addr + 7);
      const dst_addr = peek16(this.emu.uxn.ram, addr + 9);
      const src = src_page * 0x10000;
      const dst = dst_page * 0x10000;
      for (let i = length - 1; i != -1; i--) {
        this.emu.uxn.ram[dst + ((dst_addr + i) & 0xffff)] =
          this.emu.uxn.ram[src + ((src_addr + i) & 0xffff)];
      }
    }
  }

  private metadata(address: number): void {
    if (!this.emu.uxn) return;

    // For Patchies: log metadata instead of displaying in DOM
    let str = '';
    if (!this.emu.uxn.ram[address++]) {
      while (this.emu.uxn.ram[address]) {
        const byte = this.emu.uxn.ram[address++];
        str += byte == 0xa ? '\n' : String.fromCharCode(byte);
      }
      console.log('ROM metadata:', str);
    }
  }

  deo(addr: number): void {
    if (!this.emu.uxn) return;

    switch (addr) {
      case 0x07:
        this.metadata(peek16(this.emu.uxn.dev, 0x06));
        break;
      case 0x03:
        this.expansion(peek16(this.emu.uxn.dev, 0x02));
        break;
      case 0x08:
      case 0x09:
      case 0x0a:
      case 0x0b:
      case 0x0c:
      case 0x0d:
        // Update palette (call twice like uxn5)
        if (this.emu.screen) {
          this.emu.screen.update_palette();
          this.emu.screen.update_palette();
        }
        break;
      case 0x0f:
        console.warn('Program ended.');
        break;
    }
  }
}
