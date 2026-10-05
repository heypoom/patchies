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

import { DEFAULT_STICK_CALIBRATION, parseStickCalibration, type StickCalibration } from './stick';

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
  nodeId: string;
  device: JoyconDeviceFilter;
  onReport: (report: JoyconInputReport, device: JoyconDeviceInfo) => void;
  onDevicesChange?: (devices: JoyconDeviceInfo[]) => void;
}

interface JoyconConnection {
  hid: HIDDevice;
  info: JoyconDeviceInfo;
  onInputReport: (event: Event) => void;
  stickCalibration: StickCalibration;
}

const HID_FILTERS = [
  { vendorId: JOYCON_VENDOR_ID, productId: JOYCON_LEFT_PRODUCT_ID },
  { vendorId: JOYCON_VENDOR_ID, productId: JOYCON_RIGHT_PRODUCT_ID }
];

/** Delay between init subcommands; Joy-Cons drop subcommands sent back to back. */
const SUBCOMMAND_DELAY_MS = 50;

/** Connected Joy-Cons, for views. */
export const joyconDevices = writable<JoyconDeviceInfo[]>([]);

/** Controller claimed by each runtime node, for views. */
export const joyconAssignments = writable(new Map<string, JoyconDeviceInfo>());

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
  private assignments = new Map<string, JoyconDeviceInfo>();
  private packetCounter = 0;
  private nextDeviceId = 1;
  private listeningForDisconnects = false;

  static getInstance(): JoyconSystem {
    JoyconSystem.instance ??= new JoyconSystem();

    return JoyconSystem.instance;
  }

  static isSupported = () => typeof navigator !== 'undefined' && getHID() !== undefined;

  getDevices = (): JoyconDeviceInfo[] => this.connections.map((connection) => connection.info);

  getAssignedDevice = (nodeId: string) => this.assignments.get(nodeId);

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

  async disconnect(nodeId: string): Promise<void> {
    const info = this.getAssignedDevice(nodeId);
    const connection = this.connections.find((c) => c.info.id === info?.id);
    if (!connection) return;

    this.removeConnection(connection);

    await connection.hid.close();
  }

  subscribe(subscriber: JoyconSubscriber): () => void {
    this.subscribers.add(subscriber);
    this.publishDevices();

    return () => {
      this.subscribers.delete(subscriber);
      this.assignments.delete(subscriber.nodeId);
      this.publishDevices();
    };
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
      stickCalibration: DEFAULT_STICK_CALIBRATION,
      info: { id: `joycon-${this.nextDeviceId++}`, side, label: hid.productName || 'Joy-Con' },
      onInputReport: (event) => this.handleInputReport(connection, event as HIDInputReportEvent)
    };

    hid.addEventListener('inputreport', connection.onInputReport);
    this.connections.push(connection);

    connection.stickCalibration = await this.readStickCalibration(hid, side);

    await this.sendSubcommand(hid, SUBCOMMAND_ENABLE_IMU, [0x01]);
    await this.sendSubcommand(hid, SUBCOMMAND_SET_INPUT_MODE, [INPUT_MODE_STANDARD_FULL]);
    await this.sendSubcommand(hid, SUBCOMMAND_SET_PLAYER_LIGHTS, [side === 'left' ? 0x01 : 0x02]);

    this.publishDevices();
  }

  private async readStickCalibration(hid: HIDDevice, side: JoyconSide): Promise<StickCalibration> {
    try {
      const user = await this.readSPI(hid, side === 'left' ? 0x8010 : 0x801b, 11);

      if (user && user.getUint16(0, true) === 0xa1b2) {
        const calibration = parseStickCalibration(
          new DataView(user.buffer, user.byteOffset + 2, 9),
          side
        );

        if (calibration) return calibration;
      }

      const factory = await this.readSPI(hid, side === 'left' ? 0x603d : 0x6046, 9);
      const calibration = factory && parseStickCalibration(factory, side);
      if (calibration) return calibration;
    } catch (error) {
      console.warn('[joycon] could not read stick calibration', { side, error });
    }

    console.warn('[joycon] using approximate stick calibration', { side });

    return DEFAULT_STICK_CALIBRATION;
  }

  private async readSPI(hid: HIDDevice, address: number, length: number): Promise<DataView | null> {
    let settle: (data: DataView | null) => void = () => {};

    const response = new Promise<DataView | null>((resolve) => {
      settle = resolve;
    });

    const onReport = (event: Event) => {
      const { reportId, data } = event as HIDInputReportEvent;
      if (reportId !== 0x21 || data.byteLength < 19 + length) return;

      const matches =
        data.getUint8(12) === 0x90 &&
        data.getUint8(13) === 0x10 &&
        data.getUint32(14, true) === address &&
        data.getUint8(18) === length;
      if (!matches) return;

      settle(new DataView(data.buffer, data.byteOffset + 19, length));
    };

    const timeout = setTimeout(() => settle(null), 500);

    hid.addEventListener('inputreport', onReport);

    try {
      await this.sendSubcommand(hid, 0x10, [
        address & 0xff,
        (address >> 8) & 0xff,
        (address >> 16) & 0xff,
        (address >> 24) & 0xff,
        length
      ]);

      return await response;
    } finally {
      clearTimeout(timeout);
      hid.removeEventListener('inputreport', onReport);
    }
  }

  private async sendSubcommand(hid: HIDDevice, subcommand: number, args: number[]): Promise<void> {
    const payload = buildSubcommand(this.packetCounter++, subcommand, args);

    await hid.sendReport(OUTPUT_REPORT_ID, payload);
    await delay(SUBCOMMAND_DELAY_MS);
  }

  private handleInputReport(connection: JoyconConnection, event: HIDInputReportEvent): void {
    if (event.reportId !== FULL_INPUT_REPORT_ID) return;

    const report = parseFullInputReport(
      event.data,
      connection.info.side,
      connection.stickCalibration
    );
    if (!report) return;

    for (const subscriber of this.subscribers) {
      if (this.getAssignedDevice(subscriber.nodeId)?.id !== connection.info.id) continue;

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

    // Preserve valid claims before allocating free controllers to waiting nodes.
    for (const subscriber of this.subscribers) {
      const assigned = this.getAssignedDevice(subscriber.nodeId);
      const matches =
        assigned && (subscriber.device === 'any' || assigned.side === subscriber.device);

      if (!matches || !devices.some((device) => device.id === assigned?.id)) {
        this.assignments.delete(subscriber.nodeId);
      }
    }

    const claimed = new Set([...this.assignments.values()].map((device) => device.id));

    for (const subscriber of this.subscribers) {
      if (this.assignments.has(subscriber.nodeId)) continue;

      const available = devices.find(
        (device) =>
          !claimed.has(device.id) &&
          (subscriber.device === 'any' || device.side === subscriber.device)
      );

      if (available) {
        this.assignments.set(subscriber.nodeId, available);
        claimed.add(available.id);
        console.debug('[joycon] assigned controller', {
          nodeId: subscriber.nodeId,
          device: available
        });
      }
    }

    joyconDevices.set(devices);
    joyconAssignments.set(new Map(this.assignments));

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
