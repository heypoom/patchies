export class WrappingStack {
  private sp = 0;
  private stack: number[];
  private stackSize: number;

  constructor(stackSize = 256) {
    this.stackSize = stackSize;
    this.stack = [];
    for (let ii = 0; ii < stackSize; ++ii) {
      this.stack.push(0);
    }
  }

  push(v: number): void {
    this.stack[this.sp++] = v;
    this.sp = this.sp % this.stackSize;
  }

  pop(): number {
    this.sp = this.sp === 0 ? this.stackSize - 1 : this.sp - 1;
    return this.stack[this.sp];
  }

  pick(index: number): number {
    let i = this.sp - Math.floor(index) - 1;
    while (i < 0) {
      i += this.stackSize;
    }
    return this.stack[i % this.stackSize];
  }

  put(index: number, value: number): void {
    let i = this.sp - Math.floor(index);
    while (i < 0) {
      i += this.stackSize;
    }
    this.stack[i % this.stackSize] = value;
  }

  getSP(): number {
    return this.sp;
  }
}
