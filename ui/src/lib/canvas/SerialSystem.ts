import { updateSerialPorts, type SerialPortInfo } from '../../stores/serial.store';

export interface SerialSubscriber {
  nodeId: string;
  onLine: (line: string) => void;
  onRawData?: (chunk: string) => void;
}

interface SerialPortEntry {
  port: SerialPort;
  portId: string;
  baudRate: number;
  connected: boolean;
  label: string;
  lineBuffer: string;
  subscribers: Map<string, SerialSubscriber>;
  abortController: AbortController | null;
  readLoopPromise: Promise<void> | null;
}

let nextPortId = 1;

export class SerialSystem {
  private static instance: SerialSystem;
  private ports: Map<string, SerialPortEntry> = new Map();
  private pendingCloses: Map<SerialPort, Promise<void>> = new Map();

  static getInstance(): SerialSystem {
    if (!SerialSystem.instance) {
      SerialSystem.instance = new SerialSystem();
    }
    return SerialSystem.instance;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /** Prompt user to select a port, open it (or reuse if already open), return portId */
  async requestPort(options?: { baudRate?: number; label?: string }): Promise<string> {
    if (!SerialSystem.isSupported()) {
      throw new Error('WebSerial API is not supported in this browser');
    }

    const baudRate = options?.baudRate ?? 9600;
    const port = await navigator.serial.requestPort();

    // If this physical port is already managed, return the existing portId
    const existing = this.findEntryByPort(port);

    if (existing) {
      console.log(`[serial] reusing existing port: ${existing.portId}`);
      return existing.portId;
    }

    // Wait for any pending close on this port before re-opening
    const pendingClose = this.pendingCloses.get(port);
    if (pendingClose) {
      await pendingClose;
      this.pendingCloses.delete(port);
    }

    await port.open({ baudRate });

    const portId = `serial-${nextPortId++}`;
    const label = options?.label ?? `Port ${portId}`;

    const entry: SerialPortEntry = {
      port,
      portId,
      baudRate,
      connected: true,
      label,
      lineBuffer: '',
      subscribers: new Map(),
      abortController: null,
      readLoopPromise: null
    };

    this.ports.set(portId, entry);
    entry.readLoopPromise = this.startReadLoop(entry);
    this.syncStore();

    console.log(`[serial] port opened: ${portId} @ ${baudRate} baud`);
    return portId;
  }

  /** Find an existing entry by the underlying SerialPort object */
  private findEntryByPort(port: SerialPort): SerialPortEntry | undefined {
    for (const entry of this.ports.values()) {
      if (entry.port === port) {
        return entry;
      }
    }
  }

  /** Subscribe a node to receive data from a port */
  subscribe(portId: string, subscriber: SerialSubscriber): void {
    const entry = this.ports.get(portId);
    if (!entry) {
      console.warn(`[serial] port not found: ${portId}`);
      return;
    }

    entry.subscribers.set(subscriber.nodeId, subscriber);
    this.syncStore();
  }

  /** Unsubscribe a node from a port */
  unsubscribe(portId: string, nodeId: string): void {
    const entry = this.ports.get(portId);
    if (!entry) return;

    entry.subscribers.delete(nodeId);
    this.syncStore();
  }

  /** Write string data to a port (appends line ending) */
  async write(portId: string, data: string, lineEnding: string = '\r\n'): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry?.connected || !entry.port.writable) {
      throw new Error('Port not connected or not writable');
    }

    const encoder = new TextEncoder();
    const writer = entry.port.writable.getWriter();
    try {
      await writer.write(encoder.encode(data + lineEnding));
    } finally {
      writer.releaseLock();
    }
  }

  /** Write raw bytes to a port */
  async writeRaw(portId: string, data: Uint8Array): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry?.connected || !entry.port.writable) {
      throw new Error('Port not connected or not writable');
    }

    const writer = entry.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  /** Disconnect and close a port */
  async closePort(portId: string): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry) return;

    const port = entry.port;

    // Mark disconnected and remove from map immediately so UI updates
    entry.connected = false;
    this.ports.delete(portId);
    this.syncStore();

    // Perform async cleanup and track the promise so requestPort can await it
    const closePromise = this.performClose(entry);
    this.pendingCloses.set(port, closePromise);

    try {
      await closePromise;
    } finally {
      this.pendingCloses.delete(port);
    }

    console.log(`[serial] port closed: ${portId}`);
  }

  private async performClose(entry: SerialPortEntry): Promise<void> {
    // Abort the read loop — this signals pipeTo to stop and release the stream lock
    entry.abortController?.abort();
    entry.abortController = null;

    // Wait for the read loop to fully unwind so streams are unlocked
    if (entry.readLoopPromise) {
      await entry.readLoopPromise.catch(() => {});
      entry.readLoopPromise = null;
    }

    // Flush remaining line buffer
    if (entry.lineBuffer) {
      for (const sub of entry.subscribers.values()) {
        sub.onLine(entry.lineBuffer);
      }
      entry.lineBuffer = '';
    }

    try {
      await entry.port.close();
    } catch (e) {
      console.warn('[serial] error closing port:', e);
    }
  }

  /** Get info for a specific port */
  getPortInfo(portId: string): SerialPortInfo | undefined {
    const entry = this.ports.get(portId);
    if (!entry) return undefined;

    return {
      portId: entry.portId,
      label: entry.label,
      baudRate: entry.baudRate,
      connected: entry.connected,
      subscriberCount: entry.subscribers.size
    };
  }

  /** Get all port info */
  getPortInfoList(): SerialPortInfo[] {
    return Array.from(this.ports.values()).map((entry) => ({
      portId: entry.portId,
      label: entry.label,
      baudRate: entry.baudRate,
      connected: entry.connected,
      subscriberCount: entry.subscribers.size
    }));
  }

  /** Check if a port is connected */
  isConnected(portId: string): boolean {
    return this.ports.get(portId)?.connected ?? false;
  }

  /** Clean up all ports */
  async cleanup(): Promise<void> {
    const portIds = Array.from(this.ports.keys());
    for (const portId of portIds) {
      await this.closePort(portId);
    }
  }

  private async startReadLoop(entry: SerialPortEntry): Promise<void> {
    if (!entry.port.readable) return;

    const abortController = new AbortController();
    entry.abortController = abortController;

    const textDecoder = new TextDecoderStream();
    const readablePromise = entry.port.readable.pipeTo(textDecoder.writable, {
      signal: abortController.signal
    });

    const reader = textDecoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        // Broadcast raw chunks to terminal subscribers
        for (const sub of entry.subscribers.values()) {
          sub.onRawData?.(value);
        }

        // Line buffering
        entry.lineBuffer += value;
        const lines = entry.lineBuffer.split(/\r?\n/);
        entry.lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          for (const sub of entry.subscribers.values()) {
            sub.onLine(line);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[serial] read loop error:', err);
        entry.connected = false;
        this.syncStore();
      }
    } finally {
      reader.releaseLock();
      await readablePromise.catch(() => {});
    }
  }

  private syncStore(): void {
    updateSerialPorts(this.getPortInfoList());
  }
}

// @ts-expect-error -- expose SerialSystem globally for debugging
window.SerialSystem = SerialSystem.getInstance();
