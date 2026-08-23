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

export const normalizeSustainPedalValue = (value: number): number =>
  value > 0 && value <= 1 ? 127 : value;
