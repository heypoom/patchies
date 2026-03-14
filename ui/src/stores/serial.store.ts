import { writable } from 'svelte/store';

export interface SerialPortInfo {
  portId: string;
  label: string;
  baudRate: number;
  connected: boolean;
  subscriberCount: number;
}

export const serialPorts = writable<SerialPortInfo[]>([]);

export function updateSerialPorts(ports: SerialPortInfo[]): void {
  serialPorts.set(ports);
}
