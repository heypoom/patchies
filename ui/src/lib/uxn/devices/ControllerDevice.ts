// Controller device - keyboard input with vector callbacks
// Ported from uxn5/src/devices/controller.js

import { peek16 } from '../utils';

import type { UxnEmulator } from '../UxnEmulator';

export class ControllerDevice {
  private emu: UxnEmulator;
  public state: number = 0;
  private keyctrl: boolean = false;

  constructor(emu: UxnEmulator, keyctrl: boolean = false) {
    this.emu = emu;
    this.keyctrl = keyctrl;
  }

  on_button(event: KeyboardEvent): void {
    let mask = 0;
    const key = event.key;

    // Check modifiers and specific keys
    if (event.ctrlKey || key === 'Control' || key === 'z' || key === 'Z' || key === '1') {
      mask = 0x01;
    } else if (event.altKey || key === 'Alt' || key === 'x' || key === 'X' || key === '2') {
      mask = 0x02;
    } else if (event.shiftKey || key === 'Shift' || key === 'c' || key === 'C' || key === '3') {
      mask = 0x04;
    } else if (key === 'Escape' || key === 'v' || key === 'V' || key === '4') {
      mask = 0x08;
    } else if (key === 'ArrowUp') {
      mask = 0x10;
    } else if (key === 'ArrowDown') {
      mask = 0x20;
    } else if (key === 'ArrowLeft') {
      mask = 0x40;
    } else if (key === 'ArrowRight') {
      mask = 0x80;
    }

    if (event.type == 'keydown') {
      this.state |= mask;
    } else {
      this.state &= ~mask;
    }

    if (!this.emu.uxn) return;

    this.emu.uxn.dev[0x82] = this.state;
    if (mask || event.type == 'keydown') {
      this.emu.uxn.eval(peek16(this.emu.uxn.dev, 0x80));
    }
  }

  on_keybutton(event: KeyboardEvent): void {
    let mask = 0;
    const key = event.key;

    // Also catch cmd (metaKey)
    if (event.metaKey) {
      mask = 0x01;
    } else if (event.ctrlKey || key === 'Control') {
      mask = 0x01;
    } else if (event.altKey || key === 'Alt') {
      mask = 0x02;
    } else if (event.shiftKey || key === 'Shift') {
      mask = 0x04;
    } else if (key === 'Home') {
      mask = 0x08;
    } else if (key === 'ArrowUp') {
      mask = 0x10;
    } else if (key === 'ArrowDown') {
      mask = 0x20;
    } else if (key === 'ArrowLeft') {
      mask = 0x40;
    } else if (key === 'ArrowRight') {
      mask = 0x80;
    }

    let charCode = 0;

    if (event.type == 'keydown') {
      this.state |= mask;
      if (key === 'Escape') {
        charCode = 0x1b;
      } else if (key.length == 1) {
        charCode = key.charCodeAt(0);
      } else if (mask == 0) {
        // For special keys, use a fallback mapping
        // Tab, Enter, Backspace, etc. - map to their common key codes
        const specialKeyMap: Record<string, number> = {
          Tab: 9,
          Enter: 13,
          Backspace: 8,
          Delete: 127
        };

        charCode = specialKeyMap[key] || 0;
      }

      if (this.emu.uxn) {
        this.emu.uxn.dev[0x83] = charCode;
      }
    } else {
      this.state &= ~mask;
    }

    if (!this.emu.uxn) return;

    this.emu.uxn.dev[0x82] = this.state;

    if (mask || event.type == 'keydown') {
      this.emu.uxn.eval(peek16(this.emu.uxn.dev, 0x80));
    }

    if (event.type == 'keydown') {
      this.emu.uxn.dev[0x83] = 0;
    }
  }

  on_paste(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.emu.console.input(text.charAt(i).charCodeAt(0), 0);
    }
  }
}
