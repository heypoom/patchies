// Type declarations for uxn.wasm
declare module 'uxn.wasm' {
  export interface UxnInitOptions {
    deo?: (port: number, value: number) => void;
    dei?: (port: number) => number;
  }

  export interface UxnStack {
    get(index: number): number;
    ptr(): number;
  }

  export class Uxn {
    ram: Uint8Array;
    dev: Uint8Array;
    wst: UxnStack;
    rst: UxnStack;
    constructor();
    init(options?: UxnInitOptions): Promise<void>;
    load(program: Uint8Array): this;
    eval(at?: number): void;
  }
}

// Type declarations for uxn.wasm/util
declare module 'uxn.wasm/util' {
  /**
   * Assembles Uxntal source code into a Uint8Array ROM
   * @param source Uxntal assembly source code
   * @returns Compiled ROM as Uint8Array
   * @throws Error if assembly fails
   */
  export function asm(source: string): Uint8Array;
}
