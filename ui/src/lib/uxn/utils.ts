// Helper functions for 16-bit memory access (from uxn5)

export function peek16(mem: Uint8Array, addr: number): number {
  return (mem[addr] << 8) + mem[addr + 1];
}

export function poke16(mem: Uint8Array, addr: number, val: number): void {
  mem[addr] = val >> 8;
  mem[addr + 1] = val;
}
