/**
 * Holds note-off targets while MIDI CC 64 is down, then returns them together
 * when the pedal is released. Callers own the instrument-specific stop action.
 */
export class SustainPedal<T> {
  private pedalDown = false;
  private heldNoteOffs: T[] = [];

  get isDown(): boolean {
    return this.pedalDown;
  }

  hold(noteOff: T): boolean {
    if (!this.pedalDown) return false;

    this.heldNoteOffs.push(noteOff);
    return true;
  }

  set(value: number): T[] {
    const wasDown = this.pedalDown;
    this.pedalDown = value > 0;

    if (wasDown && !this.pedalDown) {
      return this.takeHeldNoteOffs();
    }

    return [];
  }

  clear(): void {
    this.heldNoteOffs = [];
  }

  private takeHeldNoteOffs(): T[] {
    const heldNoteOffs = this.heldNoteOffs;
    this.heldNoteOffs = [];

    return heldNoteOffs;
  }
}

export class ChannelSustainPedals<T> {
  private pedals = new Map<number, SustainPedal<T>>();

  isDown(channel: number): boolean {
    return this.get(channel).isDown;
  }

  hold(channel: number, noteOff: T): boolean {
    return this.get(channel).hold(noteOff);
  }

  set(channel: number, value: number): T[] {
    return this.get(channel).set(value);
  }

  clearHeld(): void {
    for (const pedal of this.pedals.values()) {
      pedal.clear();
    }
  }

  clear(): void {
    this.pedals.clear();
  }

  private get(channel: number): SustainPedal<T> {
    const pedal = this.pedals.get(channel) ?? new SustainPedal<T>();
    this.pedals.set(channel, pedal);

    return pedal;
  }
}

export const normalizeSustainPedalValue = (value: number): number =>
  value > 0 && value <= 1 ? 127 : value;
