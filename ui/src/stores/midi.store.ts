import { writable } from 'svelte/store';
import type { Input, Output } from 'webmidi';

export interface MIDIDevice {
  id: string;
  name: string;
}

export const midiInputDevices = writable<MIDIDevice[]>([]);
export const midiOutputDevices = writable<MIDIDevice[]>([]);
export const midiInitialized = writable<boolean>(false);

export function updateMIDIInputDevices(inputs: Input[]) {
  const devices = inputs.map((input) => ({
    id: input.id,
    name: input.name
  }));

  midiInputDevices.set(devices);
}

export function updateMIDIOutputDevices(outputs: Output[]) {
  const devices = outputs.map((output) => ({
    id: output.id,
    name: output.name
  }));

  midiOutputDevices.set(devices);
}
