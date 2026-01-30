/**
 * Orca Clock System with Web Worker timing
 *
 * Original implementation from Orca by Hundred Rabbits
 * Repository: https://github.com/hundredrabbits/Orca
 * License: MIT
 * Copyright (c) Hundred Rabbits
 *
 * Adapted for Patchies with TypeScript integration
 */

import type { Orca } from './Orca';
import type { IO } from './io/IO';

export interface ClockCallback {
  onTick(): void;
}

export class Clock {
  isPaused: boolean = true;
  isPuppet: boolean = false;
  speed: { value: number; target: number } = { value: 120, target: 120 };

  private worker: Worker | null = null;
  private ticks: number[] = [];
  private callback: ClockCallback | null = null;
  private io: IO | null = null;

  constructor(_orca: Orca) {
    this.speed.value = 120;
    this.speed.target = 120;
    this.loadSpeed();
  }

  setIO(io: IO): void {
    this.io = io;
  }

  start(): void {
    this.clear();
    this.play();
  }

  play(msg: boolean = false, _midiStart: boolean = false): void {
    if (this.isPaused === false) return;
    this.isPaused = false;

    if (msg) {
      // Emit MIDI clock start
    }

    this.setTimer(this.speed.value);
  }

  stop(msg: boolean = false): void {
    if (this.isPaused === true) return;
    this.isPaused = true;

    this.clearTimer();

    if (msg) {
      // Emit MIDI clock stop
    }

    // Silence all active notes (matching original Orca)
    if (this.io) {
      this.io.silence();
    }
  }

  togglePlay(msg: boolean = false): void {
    if (this.isPaused) {
      this.play(msg);
    } else {
      this.stop(msg);
    }
  }

  touch(): void {
    // Advance single frame
    if (this.callback) {
      this.callback.onTick();
    }
  }

  setSpeed(value?: number, target?: number, setTimer: boolean = true): void {
    if (value !== undefined) {
      this.speed.value = value;
    }

    if (target !== undefined) {
      this.speed.target = target;
    }

    if (setTimer && !this.isPaused) {
      this.setTimer(this.speed.value);
    }

    this.saveSpeed();
  }

  modSpeed(mod: number, animate: boolean = false): void {
    if (animate) {
      this.speed.target = Math.max(60, this.speed.target + mod);
      this.saveSpeed();
    } else {
      this.setSpeed(Math.max(60, this.speed.value + mod));
    }
  }

  setFrame(_f: number): void {
    // Used by nodes to set frame (when puppet mode enabled)
  }

  // External clock support (MIDI clock input)
  tap(): void {
    this.ticks.push(Date.now());
  }

  untap(): void {
    this.ticks = [];
  }

  // Setters
  setCallback(callback: ClockCallback): void {
    this.callback = callback;
  }

  // Private methods

  private createWorker(): Worker {
    const script = `
      let intervalId = null;
      onmessage = (e) => {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
          postMessage(true);
        }, e.data);
      };
    `;

    const blob = new Blob([script], { type: 'text/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }

  private setTimer(bpm: number): void {
    if (bpm < 60) {
      console.warn('Clock: BPM too low', bpm);
      return;
    }

    this.clearTimer();

    this.worker = this.createWorker();
    // Calculate interval: (60000 ms per minute / bpm) / 4 ticks per quarter note
    const interval = 60000 / bpm / 4;

    this.worker.postMessage(interval);
    this.worker.onmessage = () => {
      if (!this.isPaused && this.callback) {
        this.callback.onTick();
      }
    };
  }

  private clearTimer(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private clear(): void {
    this.clearTimer();
    this.ticks = [];
  }

  private saveSpeed(): void {
    try {
      localStorage.setItem('orca-bpm', String(this.speed.value));
    } catch {
      console.warn('Could not save BPM to localStorage');
    }
  }

  private loadSpeed(): void {
    try {
      const saved = localStorage.getItem('orca-bpm');
      if (saved) {
        const bpm = parseInt(saved);
        if (!isNaN(bpm) && bpm >= 60) {
          this.speed.value = bpm;
          this.speed.target = bpm;
        }
      }
    } catch {
      console.warn('Could not load BPM from localStorage');
    }
  }

  destroy(): void {
    this.clearTimer();
  }
}
