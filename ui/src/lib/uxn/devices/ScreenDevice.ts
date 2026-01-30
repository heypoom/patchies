// Screen device - complex rendering with layers, palette, sprites
// Ported from uxn5/src/devices/screen.js

import type { UxnEmulator } from '../UxnEmulator';

function MAR(x: number): number {
  return x + 0x8;
}

function MAR2(x: number): number {
  return x + 0x10;
}

function clamp(v: number, a: number, b: number): number {
  if (v < a) return a;
  else if (v >= b) return b;
  else return v;
}

function twos(v: number): number {
  if (v & 0x8000) return v - 0x10000;
  return v;
}

const blending = [
  [0, 0, 0, 0, 1, 0, 1, 1, 2, 2, 0, 2, 3, 3, 3, 0],
  [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  [1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1, 1, 2, 3, 1],
  [2, 3, 1, 2, 2, 3, 1, 2, 2, 3, 1, 2, 2, 3, 1, 2]
];

export class ScreenDevice {
  private emu: UxnEmulator;
  public repaint: number = 0;
  public pixels: Uint8ClampedArray = new Uint8ClampedArray(0);
  public scale: number = 1;
  public zoom: number = 1;
  public width: number = 0;
  public height: number = 0;
  public layers: { fg: Uint8ClampedArray; bg: Uint8ClampedArray } = {
    fg: new Uint8ClampedArray(0),
    bg: new Uint8ClampedArray(0)
  };
  public palette: number[][] = [[], [], [], []];
  public x1: number = 0;
  public y1: number = 0;
  public x2: number = 0;
  public y2: number = 0;
  public vector: number = 0;

  public display: HTMLCanvasElement | null = null;
  public displayctx: CanvasRenderingContext2D | null = null;

  // Register state
  private rX: number = 0;
  private rY: number = 0;
  private rA: number = 0;
  private rMX: number = 0;
  private rMY: number = 0;
  private rMA: number = 0;
  private rML: number = 0;
  private rDX: number = 0;
  private rDY: number = 0;

  constructor(emu: UxnEmulator) {
    this.emu = emu;
  }

  init(canvas: HTMLCanvasElement): void {
    this.display = canvas;
    this.displayctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!this.displayctx) {
      throw new Error('Failed to get 2d context from canvas');
    }
    this.set_zoom(1);
    this.resize(512, 320, 1);
  }

  changed(): boolean {
    this.x1 = clamp(this.x1, 0, this.width);
    this.y1 = clamp(this.y1, 0, this.height);
    this.x2 = clamp(this.x2, 0, this.width);
    this.y2 = clamp(this.y2, 0, this.height);
    return this.x2 > this.x1 && this.y2 > this.y1;
  }

  change(x1: number, y1: number, x2: number, y2: number): void {
    if (x1 < this.x1) this.x1 = x1;
    if (y1 < this.y1) this.y1 = y1;
    if (x2 > this.x2) this.x2 = x2;
    if (y2 > this.y2) this.y2 = y2;
  }

  update_palette(): void {
    const r = (this.emu.uxn.dev[0x8] << 8) | this.emu.uxn.dev[0x9];
    const g = (this.emu.uxn.dev[0xa] << 8) | this.emu.uxn.dev[0xb];
    const b = (this.emu.uxn.dev[0xc] << 8) | this.emu.uxn.dev[0xd];
    for (let i = 0, sft = 12; i < 4; ++i, sft -= 4) {
      const cr = (r >> sft) & 0xf;
      const cg = (g >> sft) & 0xf;
      const cb = (b >> sft) & 0xf;
      this.palette[i] = [cr | (cr << 4), cg | (cg << 4), cb | (cb << 4)];
    }
    this.repaint = 1;
  }

  resize(width: number, height: number, scale: number): void {
    width = clamp(width, 8, 0x800);
    height = clamp(height, 8, 0x800);
    scale = clamp(scale, 1, 3);
    /* on rescale */
    const length = width * height * 4 * scale * scale;
    this.pixels = new Uint8ClampedArray(length);
    this.scale = scale;
    /* on resize */
    if (this.width != width || this.height != height) {
      const layerLength = MAR2(width) * MAR2(height);
      this.layers.fg = new Uint8ClampedArray(layerLength);
      this.layers.bg = new Uint8ClampedArray(layerLength);
      this.width = width;
      this.height = height;
    }
    this.repaint = 1;
    console.log(`Resize requested: ${width}x${height}`);
    if (this.displayctx) {
      this.displayctx.canvas.width = width;
      this.displayctx.canvas.height = height;
    }
    this.set_zoom(this.zoom);
  }

  redraw(): void {
    for (let y = this.y1; y < this.y2; y++) {
      const ys = y * this.scale;
      for (let x = this.x1, i = MAR(x) + MAR(y) * MAR2(this.width); x < this.x2; x++, i++) {
        const color = this.palette[this.layers.fg[i] ? this.layers.fg[i] : this.layers.bg[i]];
        for (let k = 0; k < this.scale; k++) {
          const oo = ((ys + k) * this.width + x) * this.scale * 4;
          for (let l = 0; l < this.scale; l++) {
            this.pixels[oo + l + 0] = color[0];
            this.pixels[oo + l + 1] = color[1];
            this.pixels[oo + l + 2] = color[2];
            this.pixels[oo + l + 3] = 0xff;
          }
        }
      }
    }
    this.x1 = this.y1 = this.x2 = this.y2 = 0;
  }

  dei(addr: number): number {
    switch (addr) {
      case 0x22:
        return this.width >> 8;
      case 0x23:
        return this.width;
      case 0x24:
        return this.height >> 8;
      case 0x25:
        return this.height;
      case 0x28:
        return this.rX >> 8;
      case 0x29:
        return this.rX;
      case 0x2a:
        return this.rY >> 8;
      case 0x2b:
        return this.rY;
      case 0x2c:
        return this.rA >> 8;
      case 0x2d:
        return this.rA;
      default:
        return this.emu.uxn.dev[addr];
    }
  }

  deo(addr: number): void {
    switch (addr) {
      case 0x21:
        this.vector = (this.emu.uxn.dev[0x20] << 8) | this.emu.uxn.dev[0x21];
        return;
      case 0x23:
        this.resize(
          (this.emu.uxn.dev[0x22] << 8) | this.emu.uxn.dev[0x23],
          this.height,
          this.scale
        );
        return;
      case 0x25:
        this.resize(this.width, (this.emu.uxn.dev[0x24] << 8) | this.emu.uxn.dev[0x25], this.scale);
        return;
      case 0x26:
        this.rMX = this.emu.uxn.dev[0x26] & 0x1;
        this.rMY = this.emu.uxn.dev[0x26] & 0x2;
        this.rMA = this.emu.uxn.dev[0x26] & 0x4;
        this.rML = this.emu.uxn.dev[0x26] >> 4;
        this.rDX = this.rMX << 3;
        this.rDY = this.rMY << 2;
        return;
      case 0x28:
      case 0x29:
        this.rX = (this.emu.uxn.dev[0x28] << 8) | this.emu.uxn.dev[0x29];
        this.rX = twos(this.rX);
        return;
      case 0x2a:
      case 0x2b:
        this.rY = (this.emu.uxn.dev[0x2a] << 8) | this.emu.uxn.dev[0x2b];
        this.rY = twos(this.rY);
        return;
      case 0x2c:
      case 0x2d:
        this.rA = (this.emu.uxn.dev[0x2c] << 8) | this.emu.uxn.dev[0x2d];
        return;
      case 0x2e: {
        const ctrl = this.emu.uxn.dev[0x2e];
        const color = ctrl & 0x3;
        const len = MAR2(this.width);
        const layer = ctrl & 0x40 ? this.layers.fg : this.layers.bg;
        /* fill mode */
        if (ctrl & 0x80) {
          let x1: number, x2: number, y1: number, y2: number;
          if (ctrl & 0x10) {
            x1 = 0;
            x2 = this.rX;
          } else {
            x1 = this.rX;
            x2 = this.width;
          }
          if (ctrl & 0x20) {
            y1 = 0;
            y2 = this.rY;
          } else {
            y1 = this.rY;
            y2 = this.height;
          }
          this.repaint = 1;
          const x1mar = MAR(x1);
          const y1mar = MAR(y1);
          const hor = MAR(x2) - x1mar;
          const ver = MAR(y2) - y1mar;
          for (let ay = y1mar * len, by = ay + ver * len; ay < by; ay += len) {
            for (let ax = ay + x1mar, bx = ax + hor; ax < bx; ax++) {
              layer[ax] = color & 0xff;
            }
          }
        } else {
          /* pixel mode */
          if (this.rX >= 0 && this.rY >= 0 && this.rX < len && this.rY < this.height) {
            layer[MAR(this.rX) + MAR(this.rY) * len] = color;
          }
          if (!this.repaint) {
            this.change(this.rX, this.rY, this.rX + 1, this.rY + 1);
          }
          if (this.rMX) this.rX++;
          if (this.rMY) this.rY++;
        }
        return;
      }
      case 0x2f: {
        const ctrl = this.emu.uxn.dev[0x2f];
        const blend = ctrl & 0xf;
        const opaque = blend % 5;
        const fx = ctrl & 0x10 ? -1 : 1;
        const fy = ctrl & 0x20 ? -1 : 1;
        const qfx = fx > 0 ? 7 : 0;
        const qfy = fy < 0 ? 7 : 0;
        const dxy = fy * this.rDX;
        const dyx = fx * this.rDY;
        const wmar = MAR(this.width);
        const wmar2 = MAR2(this.width);
        const hmar2 = MAR2(this.height);
        let x = this.rX;
        let y = this.rY;
        const layer = ctrl & 0x40 ? this.layers.fg : this.layers.bg;
        if (ctrl & 0x80) {
          const addr_incr = this.rMA << 2;
          for (let i = 0; i <= this.rML; i++, x += dyx, y += dxy, this.rA += addr_incr) {
            const xmar = MAR(x);
            const ymar = MAR(y);
            const xmar2 = MAR2(x);
            const ymar2 = MAR2(y);
            if (xmar >= 0 && xmar < wmar && ymar2 >= 0 && ymar2 < hmar2) {
              const by = ymar2 * wmar2;
              for (let ay = ymar * wmar2, qy = qfy; ay < by; ay += wmar2, qy += fy) {
                const ch1 = this.emu.uxn.ram[this.rA + qy];
                const ch2 = (this.emu.uxn.ram[this.rA + qy + 8] << 1) & 0xff;
                const bx = xmar2 + ay;
                for (let ax = xmar + ay, qx = qfx; ax < bx; ax++, qx -= fx) {
                  const color = ((ch1 >> qx) & 1) | ((ch2 >> qx) & 2);
                  if (opaque || color) {
                    layer[ax] = blending[color][blend];
                  }
                }
              }
            }
          }
        } else {
          const addr_incr = this.rMA << 1;
          for (let i = 0; i <= this.rML; i++, x += dyx, y += dxy, this.rA += addr_incr) {
            const xmar = MAR(x);
            const ymar = MAR(y);
            const xmar2 = MAR2(x);
            const ymar2 = MAR2(y);
            if (xmar >= 0 && xmar < wmar && ymar2 >= 0 && ymar2 < hmar2) {
              const by = ymar2 * wmar2;
              for (let ay = ymar * wmar2, qy = qfy; ay < by; ay += wmar2, qy += fy) {
                const ch1 = this.emu.uxn.ram[this.rA + qy];
                const bx = xmar2 + ay;
                for (let ax = xmar + ay, qx = qfx; ax < bx; ax++, qx -= fx) {
                  const color = (ch1 >> qx) & 1;
                  if (opaque || color) {
                    layer[ax] = blending[color][blend];
                  }
                }
              }
            }
          }
        }
        let x1: number, x2: number, y1: number, y2: number;
        if (fx < 0) {
          x1 = x;
          x2 = this.rX;
        } else {
          x1 = this.rX;
          x2 = x;
        }
        if (fy < 0) {
          y1 = y;
          y2 = this.rY;
        } else {
          y1 = this.rY;
          y2 = y;
        }
        if (!this.repaint) {
          this.change(x1 - 8, y1 - 8, x2 + 8, y2 + 8);
        }
        if (this.rMX) this.rX += this.rDX * fx;
        if (this.rMY) this.rY += this.rDY * fy;
        return;
      }
    }
  }

  toggle_zoom(): void {
    this.set_zoom(this.zoom == 2 ? 1 : 2);
  }

  set_zoom(zoom: number): void {
    this.zoom = zoom;
    // Zoom is handled by CSS in the node component
  }
}
