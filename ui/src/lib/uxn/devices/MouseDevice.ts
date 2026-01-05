// Mouse device - pointer input with vector callbacks
// Ported from uxn5/src/devices/mouse.js

import { peek16, poke16 } from '../utils';

import type { UxnEmulator } from '../UxnEmulator';

function parse_buttons(buttons: number): number {
	let state = 0;
	if (buttons & 0x1) state |= 0x1;
	if (buttons & 0x2) state |= 0x4;
	if (buttons & 0x4) state |= 0x2;

	return state;
}

export class MouseDevice {
	private emu: UxnEmulator;

	constructor(emu: UxnEmulator) {
		this.emu = emu;
	}

	private mouse_down(state: number): void {
		this.emu.uxn.dev[0x96] = state;
		this.emu.uxn.eval(peek16(this.emu.uxn.dev, 0x90));
	}

	private mouse_up(state: number): void {
		this.emu.uxn.dev[0x96] = state;
		this.emu.uxn.eval(peek16(this.emu.uxn.dev, 0x90));
	}

	private mouse_move(x: number, y: number): void {
		poke16(this.emu.uxn.dev, 0x92, x);
		poke16(this.emu.uxn.dev, 0x94, y);

		this.emu.uxn.eval(peek16(this.emu.uxn.dev, 0x90));
	}

	on_move(event: PointerEvent, canvas: HTMLCanvasElement): void {
		const bounds = canvas.getBoundingClientRect();
		const x = (canvas.width * (event.clientX - bounds.left)) / bounds.width;
		const y = (canvas.height * (event.clientY - bounds.top)) / bounds.height;

		this.mouse_move(x, y);
	}

	on_down(event: PointerEvent): void {
		this.mouse_down(parse_buttons(event.buttons));
	}

	on_up(event: PointerEvent): void {
		this.mouse_up(parse_buttons(event.buttons));
	}

	on_scroll(event: WheelEvent): void {
		if (event.deltaY < 0) {
			poke16(this.emu.uxn.dev, 0x9c, 0xffff);
		} else {
			poke16(this.emu.uxn.dev, 0x9c, 0x0001);
		}

		this.emu.uxn.eval(peek16(this.emu.uxn.dev, 0x90));
		poke16(this.emu.uxn.dev, 0x9c, 0x0000);
	}
}
