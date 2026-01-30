type OnTick = (dt: number) => void;

export class Loop {
  #ts: number = performance.now();
  #running = false;
  #raf?: number;
  readonly #fn: OnTick;

  constructor(fn: OnTick) {
    this.#fn = fn;
  }

  start = (): this => {
    if (this.#running) {
      return this;
    }

    this.#running = true;
    this.#ts = performance.now();
    this.#raf = requestAnimationFrame(this.tick);

    return this;
  };

  stop = (): this => {
    this.#running = false;
    if (this.#raf) {
      cancelAnimationFrame(this.#raf);
    }
    this.#raf = undefined;

    return this;
  };

  toggle = (): this => {
    if (this.#running) {
      this.stop();
    } else {
      this.start();
    }

    return this;
  };

  tick = (): this => {
    this.#raf = requestAnimationFrame(this.tick);

    const time = performance.now();
    const dt = time - this.#ts;

    this.#fn(dt);

    this.#ts = time;

    return this;
  };
}
