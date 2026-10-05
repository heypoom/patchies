import { writable } from 'svelte/store';

import {
  JOYCON_LEFT_PRODUCT_ID,
  JOYCON_RIGHT_PRODUCT_ID,
  JOYCON_VENDOR_ID,
  type JoyconDeviceFilter,
  type JoyconSide
} from './constants';
import {
  FULL_INPUT_REPORT_ID,
  INPUT_MODE_STANDARD_FULL,
  OUTPUT_REPORT_ID,
  SUBCOMMAND_ENABLE_IMU,
  SUBCOMMAND_SET_INPUT_MODE,
  SUBCOMMAND_SET_PLAYER_LIGHTS,
  buildSubcommand,
  parseFullInputReport,
  type JoyconInputReport
} from './joycon-protocol';

// Minimal WebHID typings; the project does not ship @types/w3c-web-hid.
interface HIDDevice extends EventTarget {
  opened: boolean;
  productId: number;
  productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
}

interface HIDInputReportEvent extends Event {
  device: HIDDevice;
  reportId: number;
  data: DataView;
}

interface HIDConnectionEvent extends Event {
  device: HIDDevice;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: {
    filters: { vendorId: number; productId: number }[];
  }): Promise<HIDDevice[]>;
}

export interface JoyconDeviceInfo {
  id: string;
  side: JoyconSide;
  label: string;
}

export interface JoyconSubscriber {
  device: JoyconDeviceFilter;
  onReport: (report: JoyconInputReport, device: JoyconDeviceInfo) => void;
  onDevicesChange?: (devices: JoyconDeviceInfo[]) => void;
}

interface JoyconConnection {
  hid: HIDDevice;
  info: JoyconDeviceInfo;
  onInputReport: (event: Event) => void;
}

const HID_FILTERS = [
  { vendorId: JOYCON_VENDOR_ID, productId: JOYCON_LEFT_PRODUCT_ID },
  { vendorId: JOYCON_VENDOR_ID, productId: JOYCON_RIGHT_PRODUCT_ID }
];

/** Delay between init subcommands; Joy-Cons drop subcommands sent back to back. */
const SUBCOMMAND_DELAY_MS = 50;

/** Connected Joy-Cons, for views. */
export const joyconDevices = writable<JoyconDeviceInfo[]>([]);

/**
 * Finds the device a subscriber with the given filter reads from: the first
 * connected Joy-Con matching the side.
 */
export const findJoycon = (devices: JoyconDeviceInfo[], filter: JoyconDeviceFilter) =>
  devices.find((device) => filter === 'any' || device.side === filter);

const getHID = (): HID | undefined => (navigator as Navigator & { hid?: HID }).hid;

const isJoycon = (device: HIDDevice) =>
  device.productId === JOYCON_LEFT_PRODUCT_ID || device.productId === JOYCON_RIGHT_PRODUCT_ID;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Owns WebHID Joy-Con connections and fans parsed input reports out to
 * subscribing `joycon` objects.
 */
export class JoyconSystem {
  private static instance: JoyconSystem | null = null;

  private connections: JoyconConnection[] = [];
  private connecting = new Set<HIDDevice>();
  private subscribers = new Set<JoyconSubscriber>();
  private packetCounter = 0;
  private nextDeviceId = 1;
  private listeningForDisconnects = false;

  static getInstance(): JoyconSystem {
    JoyconSystem.instance ??= new JoyconSystem();

    return JoyconSystem.instance;
  }

  static isSupported = () => typeof navigator !== 'undefined' && getHID() !== undefined;

  getDevices = (): JoyconDeviceInfo[] => this.connections.map((connection) => connection.info);

  /** Show the browser device picker. Must run inside a user gesture. */
  async requestDevices(): Promise<void> {
    const hid = this.requireHID();
    const devices = await hid.requestDevice({ filters: HID_FILTERS });

    await Promise.all(devices.map((device) => this.connect(device)));
  }

  /** Reconnect Joy-Cons the user already granted; needs no user gesture. */
  async restoreGrantedDevices(): Promise<void> {
    const hid = getHID();
    if (!hid) return;

    const devices = await hid.getDevices();

    await Promise.all(devices.filter(isJoycon).map((device) => this.connect(device)));
  }

  async disconnect(filter: JoyconDeviceFilter): Promise<void> {
    const info = findJoycon(this.getDevices(), filter);
    const connection = this.connections.find((c) => c.info.id === info?.id);
    if (!connection) return;

    this.removeConnection(connection);

    await connection.hid.close();
  }

  subscribe(subscriber: JoyconSubscriber): () => void {
    this.subscribers.add(subscriber);

    return () => this.subscribers.delete(subscriber);
  }

  private async connect(hid: HIDDevice): Promise<void> {
    const isKnown = this.connecting.has(hid) || this.connections.some((c) => c.hid === hid);
    if (isKnown) return;

    this.connecting.add(hid);

    try {
      await this.open(hid);
    } finally {
      this.connecting.delete(hid);
    }
  }

  private async open(hid: HIDDevice): Promise<void> {
    this.listenForDisconnects();

    if (!hid.opened) await hid.open();

    const side: JoyconSide = hid.productId === JOYCON_LEFT_PRODUCT_ID ? 'left' : 'right';

    const connection: JoyconConnection = {
      hid,
      info: { id: `joycon-${this.nextDeviceId++}`, side, label: hid.productName || 'Joy-Con' },
      onInputReport: (event) => this.handleInputReport(connection, event as HIDInputReportEvent)
    };

    hid.addEventListener('inputreport', connection.onInputReport);
    this.connections.push(connection);

    await this.sendSubcommand(hid, SUBCOMMAND_ENABLE_IMU, [0x01]);
    await this.sendSubcommand(hid, SUBCOMMAND_SET_INPUT_MODE, [INPUT_MODE_STANDARD_FULL]);
    await this.sendSubcommand(hid, SUBCOMMAND_SET_PLAYER_LIGHTS, [side === 'left' ? 0x01 : 0x02]);

    this.publishDevices();
  }

  private async sendSubcommand(hid: HIDDevice, subcommand: number, args: number[]): Promise<void> {
    const payload = buildSubcommand(this.packetCounter++, subcommand, args);

    await hid.sendReport(OUTPUT_REPORT_ID, payload);
    await delay(SUBCOMMAND_DELAY_MS);
  }

  private handleInputReport(connection: JoyconConnection, event: HIDInputReportEvent): void {
    if (event.reportId !== FULL_INPUT_REPORT_ID) return;

    const report = parseFullInputReport(event.data);
    if (!report) return;

    const devices = this.getDevices();

    for (const subscriber of this.subscribers) {
      if (findJoycon(devices, subscriber.device)?.id !== connection.info.id) continue;

      subscriber.onReport(report, connection.info);
    }
  }

  private listenForDisconnects(): void {
    const hid = getHID();
    if (!hid || this.listeningForDisconnects) return;

    this.listeningForDisconnects = true;

    hid.addEventListener('disconnect', (event) => {
      const { device } = event as HIDConnectionEvent;
      const connection = this.connections.find((c) => c.hid === device);

      if (connection) this.removeConnection(connection);
    });
  }

  private removeConnection(connection: JoyconConnection): void {
    connection.hid.removeEventListener('inputreport', connection.onInputReport);
    this.connections = this.connections.filter((c) => c !== connection);

    this.publishDevices();
  }

  private publishDevices(): void {
    const devices = this.getDevices();

    joyconDevices.set(devices);

    for (const subscriber of this.subscribers) {
      subscriber.onDevicesChange?.(devices);
    }
  }

  private requireHID(): HID {
    const hid = getHID();
    if (!hid) throw new Error('WebHID is not supported in this browser. Use Chrome or Edge.');

    return hid;
  }
}
