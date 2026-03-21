import { updateSerialPorts, type SerialPortInfo } from '../../stores/serial.store';
import type { SerialParity } from './constants';

export interface SerialSubscriber {
  nodeId: string;
  onLine: (line: string) => void;
  onRawData?: (chunk: string) => void;
  onStatusChange?: (status: 'disconnected' | 'error', error?: Error) => void;
}

interface SerialPortEntry {
  port: SerialPort;
  portId: string;
  baudRate: number;
  connected: boolean;
  label: string;
  lineBuffer: string;
  subscribers: Map<string, SerialSubscriber>;
  keepReading: boolean;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  readLoopPromise: Promise<void> | null;
  writeChain: Promise<void>;
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
  async requestPort(options?: {
    baudRate?: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: SerialParity;
    label?: string;
  }): Promise<string> {
    if (!SerialSystem.isSupported()) {
      throw new Error('WebSerial API is not supported in this browser');
    }

    const baudRate = options?.baudRate ?? 9600;
    const dataBits = options?.dataBits ?? (8 as 7 | 8);
    const stopBits = options?.stopBits ?? (1 as 1 | 2);
    const parity: ParityType = options?.parity ?? 'none';
    const port = await navigator.serial.requestPort();

    // If this physical port is already managed, reuse if still connected with matching baud
    const existing = this.findEntryByPort(port);

    if (existing) {
      if (existing.connected && existing.baudRate === baudRate) {
        console.log(`[serial] reusing existing port: ${existing.portId}`);
        return existing.portId;
      }

      // Stale or baud mismatch — close old entry and fall through to re-open
      console.log(
        `[serial] closing stale port ${existing.portId} (connected=${existing.connected}, baud=${existing.baudRate}→${baudRate})`
      );
      await this.closePort(existing.portId);
    }

    // Wait for any pending close on this port before re-opening
    const pendingClose = this.pendingCloses.get(port);
    if (pendingClose) {
      await pendingClose;
      this.pendingCloses.delete(port);
    }

    await port.open({ baudRate, dataBits, stopBits, parity });

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
      keepReading: false,
      reader: null,
      readLoopPromise: null,
      writeChain: Promise.resolve()
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

  /** Enqueue a write operation on the per-port write chain to prevent stream lock races */
  private enqueueWrite(entry: SerialPortEntry, fn: () => Promise<void>): Promise<void> {
    const promise = entry.writeChain.then(fn);
    // Don't let a failed write block subsequent writes
    entry.writeChain = promise.catch(() => {});
    return promise;
  }

  /** Write string data to a port (appends line ending) */
  async write(portId: string, data: string, lineEnding: string = '\r\n'): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry?.connected) throw new Error('Port not connected');

    const encoder = new TextEncoder();
    await this.enqueueWrite(entry, async () => {
      if (!entry.port.writable) throw new Error('Port not writable');
      const writer = entry.port.writable.getWriter();
      try {
        await writer.write(encoder.encode(data + lineEnding));
      } finally {
        writer.releaseLock();
      }
    });
  }

  /** Write raw bytes to a port */
  async writeRaw(portId: string, data: Uint8Array): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry?.connected) throw new Error('Port not connected');

    await this.enqueueWrite(entry, async () => {
      if (!entry.port.writable) throw new Error('Port not writable');
      const writer = entry.port.writable.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
    });
  }

  /**
   * Send a BREAK signal via SerialPort.setSignals().
   * WebSerial supports break natively — no baud-rate switching needed.
   * Required for DMX-512 framing.
   */
  async sendBreak(portId: string): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry?.connected) throw new Error('Port not connected');

    return this.enqueueWrite(entry, async () => {
      await entry.port.setSignals({ break: true });
      await entry.port.setSignals({ break: false });
    });
  }

  /** Disconnect and close a port */
  async closePort(portId: string): Promise<void> {
    const entry = this.ports.get(portId);
    if (!entry) return;

    const port = entry.port;

    // Notify all subscribers before removing from map
    this.notifySubscribers(entry, 'disconnected');

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
    await this.stopReadLoop(entry);

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

  /**
   * Stop the read loop cleanly.
   * Uses reader.cancel() to release the stream lock before port.close() is called.
   */
  private async stopReadLoop(entry: SerialPortEntry): Promise<void> {
    entry.keepReading = false;
    if (entry.reader) {
      await entry.reader.cancel().catch(() => {});
      entry.reader = null;
    }
    if (entry.readLoopPromise) {
      await entry.readLoopPromise.catch(() => {});
      entry.readLoopPromise = null;
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
    entry.keepReading = true;
    const decoder = new TextDecoder();

    while (entry.port.readable && entry.keepReading) {
      const reader = entry.port.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>;
      entry.reader = reader;

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;

          const text = decoder.decode(value, { stream: true });

          // Broadcast raw chunks to terminal subscribers
          for (const sub of entry.subscribers.values()) {
            sub.onRawData?.(text);
          }

          // Line buffering
          entry.lineBuffer += text;
          const lines = entry.lineBuffer.split(/\r\n|\n|\r/);
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
          const error = err instanceof Error ? err : new Error(String(err));
          this.notifySubscribers(entry, 'error', error);
          entry.connected = false;
          this.syncStore();
        }
      } finally {
        reader.releaseLock();
        entry.reader = null;
      }
    }
  }

  private notifySubscribers(
    entry: SerialPortEntry,
    status: 'disconnected' | 'error',
    error?: Error
  ): void {
    for (const sub of entry.subscribers.values()) {
      sub.onStatusChange?.(status, error);
    }
  }

  private syncStore(): void {
    updateSerialPorts(this.getPortInfoList());
  }
}

if (typeof window !== 'undefined') {
  // @ts-expect-error -- expose SerialSystem globally for debugging
  window.SerialSystem = SerialSystem.getInstance();
}
