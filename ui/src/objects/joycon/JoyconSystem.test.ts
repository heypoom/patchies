import { afterEach, describe, expect, it, vi } from 'vitest';

import { JOYCON_LEFT_PRODUCT_ID, JOYCON_RIGHT_PRODUCT_ID } from './constants';
import { JoyconSystem } from './JoyconSystem';

class FakeJoycon extends EventTarget {
  opened = false;
  productName = 'Joy-Con';
  close = vi.fn(async () => {
    this.opened = false;
  });
  sendReport = vi.fn(async () => {});

  constructor(readonly productId: number) {
    super();
  }

  async open() {
    this.opened = true;
  }

  emit() {
    const event = new Event('inputreport');

    Object.assign(event, { reportId: 0x30, data: new DataView(new ArrayBuffer(48)) });
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
});
