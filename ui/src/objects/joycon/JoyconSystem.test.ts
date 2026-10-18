import { afterEach, describe, expect, it, vi } from 'vitest';

import { JOYCON_LEFT_PRODUCT_ID, JOYCON_RIGHT_PRODUCT_ID } from './constants';
import { JoyconSystem } from './JoyconSystem';

function packStick(x: number, y: number): number[] {
  return [x & 255, (x >> 8) | ((y & 15) << 4), y >> 4];
}

function calibrationBytes(side: 'left' | 'right', center = 2000): Uint8Array {
  const range = packStick(1000, 1000);
  const neutral = packStick(center, center);

  return new Uint8Array(
    side === 'left' ? [...range, ...neutral, ...range] : [...neutral, ...range, ...range]
  );
}

class FakeJoycon extends EventTarget {
  opened = false;
  productName = 'Joy-Con';
  close = vi.fn(async () => {
    this.opened = false;
  });
  mismatchSPIAddress = false;
  spi = new Map<number, Uint8Array>();
  sendReport = vi.fn(async (_reportId: number, payload: BufferSource) => {
    const bytes = new Uint8Array(payload as ArrayBuffer);
    if (bytes[9] !== 0x10) return;

    const request = new DataView(bytes.buffer, bytes.byteOffset + 10, 5);
    const address = request.getUint32(0, true);
    const length = request.getUint8(4);
    const data = new DataView(new ArrayBuffer(19 + length));

    data.setUint8(12, 0x90);
    data.setUint8(13, 0x10);
    data.setUint32(14, this.mismatchSPIAddress ? address + 1 : address, true);
    data.setUint8(18, length);
    new Uint8Array(data.buffer, 19).set(this.spi.get(address) ?? new Uint8Array(length).fill(255));
    this.emitReport(0x21, data);
  });

  constructor(readonly productId: number) {
    super();

    const side = productId === JOYCON_LEFT_PRODUCT_ID ? 'left' : 'right';
    this.spi.set(side === 'left' ? 0x603d : 0x6046, calibrationBytes(side));
  }

  async open() {
    this.opened = true;
  }

  emit(stick: [number, number] = [2000, 2000]) {
    const data = new DataView(new ArrayBuffer(48));
    const offset = this.productId === JOYCON_LEFT_PRODUCT_ID ? 5 : 8;

    new Uint8Array(data.buffer, offset, 3).set(packStick(...stick));
    this.emitReport(0x30, data);
  }

  emitReport(reportId: number, data: DataView) {
    const event = new Event('inputreport');

    Object.assign(event, { reportId, data });
    this.dispatchEvent(event);
  }
}

async function setup() {
  const left = new FakeJoycon(JOYCON_LEFT_PRODUCT_ID);
  const right = new FakeJoycon(JOYCON_RIGHT_PRODUCT_ID);
  const hid = Object.assign(new EventTarget(), { getDevices: async () => [left, right] });

  vi.stubGlobal('navigator', { hid });

  const system = new JoyconSystem();
  await system.restoreGrantedDevices();

  return { system, left, right };
}

afterEach(() => vi.unstubAllGlobals());

describe('JoyconSystem independent nodes', () => {
  it('routes two default nodes to separate controllers', async () => {
    const { system, left, right } = await setup();
    const first = vi.fn();
    const second = vi.fn();

    system.subscribe({ nodeId: 'first', device: 'any', onReport: first });
    system.subscribe({ nodeId: 'second', device: 'any', onReport: second });
    left.emit();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    right.emit();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('waits for a free controller and preserves other assignments when a node is deleted', async () => {
    const { system } = await setup();
    const release = system.subscribe({ nodeId: 'first', device: 'any', onReport: vi.fn() });
    system.subscribe({ nodeId: 'second', device: 'any', onReport: vi.fn() });
    system.subscribe({ nodeId: 'waiting', device: 'any', onReport: vi.fn() });

    const firstDevice = system.getAssignedDevice('first');
    const secondDevice = system.getAssignedDevice('second');

    expect(system.getAssignedDevice('waiting')).toBeUndefined();

    release();

    expect(system.getAssignedDevice('waiting')).toEqual(firstDevice);
    expect(system.getAssignedDevice('second')).toEqual(secondDevice);
  });

  it('keeps a node disconnected when its matching side is already claimed', async () => {
    const { system } = await setup();
    system.subscribe({ nodeId: 'first', device: 'left', onReport: vi.fn() });
    system.subscribe({ nodeId: 'second', device: 'left', onReport: vi.fn() });

    expect(system.getAssignedDevice('first')?.side).toBe('left');
    expect(system.getAssignedDevice('second')).toBeUndefined();
  });

  it('disconnects only the requesting node’s controller', async () => {
    const { system, left, right } = await setup();
    const first = vi.fn();

    system.subscribe({ nodeId: 'first', device: 'any', onReport: first });
    system.subscribe({ nodeId: 'second', device: 'any', onReport: vi.fn() });
    await system.disconnect('second');
    left.emit();

    expect(right.close).toHaveBeenCalledTimes(1);
    expect(left.close).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
    expect(system.getAssignedDevice('second')).toBeUndefined();
  });

  it('assigns controllers when they connect after nodes subscribe', async () => {
    await setup();

    const fresh = new JoyconSystem();
    const changed = vi.fn();

    fresh.subscribe({
      nodeId: 'first',
      device: 'any',
      onReport: vi.fn(),
      onDevicesChange: changed
    });
    fresh.subscribe({ nodeId: 'second', device: 'any', onReport: vi.fn() });
    await fresh.restoreGrantedDevices();

    expect(fresh.getAssignedDevice('first')?.side).toBe('left');
    expect(fresh.getAssignedDevice('second')?.side).toBe('right');
    expect(changed).toHaveBeenCalled();
  });

  it.each(['left', 'right'] as const)(
    'uses stored %s user calibration before factory calibration',
    async (side) => {
      const device = new FakeJoycon(
        side === 'left' ? JOYCON_LEFT_PRODUCT_ID : JOYCON_RIGHT_PRODUCT_ID
      );
      device.spi.set(
        side === 'left' ? 0x8010 : 0x801b,
        new Uint8Array([0xb2, 0xa1, ...calibrationBytes(side, 2300)])
      );
      vi.stubGlobal('navigator', {
        hid: Object.assign(new EventTarget(), { getDevices: async () => [device] })
      });

      const system = new JoyconSystem();
      const report = vi.fn();

      system.subscribe({ nodeId: 'node', device: 'any', onReport: report });
      await system.restoreGrantedDevices();
      device.emit([2300, 2300]);
      device.emit([3300, 2300]);

      expect(report.mock.calls[0][0].stick).toEqual([0, 0]);
      expect(report.mock.calls[1][0].stick).toEqual([1, 0]);
    }
  );

  it.each([false, true])(
    'uses factory calibration when user calibration is invalid (marked: %s)',
    async (marked) => {
      const left = new FakeJoycon(JOYCON_LEFT_PRODUCT_ID);

      if (marked) {
        left.spi.set(0x8010, new Uint8Array([0xb2, 0xa1, ...new Uint8Array(9)]));
      }

      vi.stubGlobal('navigator', {
        hid: Object.assign(new EventTarget(), { getDevices: async () => [left] })
      });

      const system = new JoyconSystem();
      const report = vi.fn();

      system.subscribe({ nodeId: 'node', device: 'left', onReport: report });
      await system.restoreGrantedDevices();
      left.emit([2000, 3000]);

      expect(report.mock.calls[0][0].stick).toEqual([0, 1]);
    }
  );

  it('times out mismatched calibration replies and still connects with approximate calibration', async () => {
    const device = new FakeJoycon(JOYCON_LEFT_PRODUCT_ID);
    device.mismatchSPIAddress = true;
    vi.stubGlobal('navigator', {
      hid: Object.assign(new EventTarget(), { getDevices: async () => [device] })
    });

    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const system = new JoyconSystem();
    const report = vi.fn();

    try {
      system.subscribe({ nodeId: 'node', device: 'left', onReport: report });
      await system.restoreGrantedDevices();
      device.emit([4095, 2048]);

      expect(report.mock.calls[0][0].stick).toEqual([1, 0]);
      expect(warning).toHaveBeenCalledWith('[joycon] using approximate stick calibration', {
        side: 'left'
      });
    } finally {
      warning.mockRestore();
    }
  });
});
