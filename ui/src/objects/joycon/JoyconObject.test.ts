import { describe, expect, it, vi } from 'vitest';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';

import { JoyconObject, type JoyconSystemLike } from './JoyconObject';
import type { JoyconInputReport } from './joycon-protocol';
import type { JoyconDeviceInfo, JoyconSubscriber } from './JoyconSystem';

const LEFT_JOYCON: JoyconDeviceInfo = { id: 'joycon-1', side: 'left', label: 'Joy-Con (L)' };

function createFakeSystem(initialDevices: JoyconDeviceInfo[] = []) {
  let devices = initialDevices;
  let subscriber: JoyconSubscriber | null = null;

  const system: JoyconSystemLike = {
    subscribe(next) {
      subscriber = next;

      return () => {
        subscriber = null;
      };
    },
    getAssignedDevice: () =>
      devices.find((device) => subscriber?.device === 'any' || device.side === subscriber?.device),
    restoreGrantedDevices: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {})
  };

  return {
    system,
    setDevices(next: JoyconDeviceInfo[]) {
      devices = next;
      subscriber?.onDevicesChange?.(next);
    },
    emit(report: JoyconInputReport) {
      subscriber?.onReport(report, devices[0]);
    },
    get subscriber() {
      return subscriber;
    }
  };
}

function createJoycon(devices: JoyconDeviceInfo[] = [LEFT_JOYCON]) {
  const fake = createFakeSystem(devices);
  const sent: Array<{ data: unknown; to: unknown }> = [];
  const values: Record<string, unknown> = {
    device: 'any',
    threshold: 20
  };

  const context = {
    send(data: unknown, options?: { to?: unknown }) {
      sent.push({ data, to: options?.to });
    },
    setData(updates: Record<string, unknown>) {
      Object.assign(values, updates);
    },
    getData: () => values
  } as unknown as ObjectContext;

  const object = new JoyconObject('joycon-node', context, fake.system);

  object.create();
  sent.length = 0;

  return { object, fake, sent, values };
}

/** A report where the Joy-Con is tilted `degrees` around its X axis, gravity along Y at rest. */
function reportAt(degrees: number, rate = 0): JoyconInputReport {
  const radians = (degrees * Math.PI) / 180;
  const sample = {
    accel: [0, Math.cos(radians), -Math.sin(radians)] as [number, number, number],
    gyro: [rate, 0, 0] as [number, number, number]
  };

  return { battery: 4, stick: [0, 0], buttons: [], samples: [sample, sample, sample] };
}

function rotate(emit: (report: JoyconInputReport) => void, from: number, to: number) {
  const reports = 20;
  const rate = (to - from) / (reports * 0.015);

  for (let i = 1; i <= reports; i++) {
    emit(reportAt(from + ((to - from) * i) / reports, rate));
  }
}

const sentTo = (sent: Array<{ data: unknown; to: unknown }>, outlet: number) =>
  sent.filter((message) => message.to === outlet).map((message) => message.data);

describe('JoyconObject', () => {
  it('reconnects granted Joy-Cons on create and on bang', () => {
    const { object, fake } = createJoycon();

    object.onMessage({ type: 'bang' });

    expect(fake.system.restoreGrantedDevices).toHaveBeenCalledTimes(2);
  });

  it('emits raw motion data on the first outlet', () => {
    const { fake, sent } = createJoycon();

    fake.emit({ ...reportAt(0), buttons: ['zl'] });

    expect(sentTo(sent, 0)).toEqual([
      {
        type: 'motion',
        side: 'left',
        accel: [0, 1, -0],
        gyro: [0, 0, 0],
        angles: [0, 0, 0],
        stick: [0, 0],
        buttons: ['zl']
      }
    ]);
  });

  it('streams normalized stick coordinates during motion calibration', () => {
    const { fake, sent } = createJoycon();

    fake.emit({ ...reportAt(0), stick: [0.75, -0.5] });

    expect(sentTo(sent, 0)).toEqual([
      expect.objectContaining({ stick: [0.75, -0.5], angles: [0, 0, 0] })
    ]);
  });

  it('emits per-axis positive and neutral moves on the second outlet', () => {
    const { fake, sent } = createJoycon();

    for (let i = 0; i < 12; i++) fake.emit(reportAt(0));

    rotate(fake.emit, 0, 35);
    rotate(fake.emit, 35, 0);

    const moves = sentTo(sent, 1).map((message) => (message as { direction: string }).direction);

    expect(moves).toEqual(['positive', 'neutral']);
    expect(sentTo(sent, 1).every((message) => (message as { axis: string }).axis === 'x')).toBe(
      true
    );
  });

  it('emits all angles together and independent events for simultaneous axis motion', () => {
    const { fake, sent } = createJoycon();
    for (let i = 0; i < 30; i++) {
      fake.emit({
        battery: 4,
        stick: [0, 0],
        buttons: [],
        samples: [{ accel: [0, 0, 0], gyro: [0, 0, 0] }]
      });
    }

    sent.length = 0;
    fake.emit({
      battery: 4,
      stick: [0, 0],
      buttons: ['a'],
      samples: [{ accel: [0, 0, 0], gyro: [6000, -6000, 8000] }]
    });

    expect(sentTo(sent, 0)).toEqual([
      {
        type: 'motion',
        side: 'left',
        accel: [0, 0, 0],
        gyro: [6000, -6000, 8000],
        angles: [30, -30, 40],
        stick: [0, 0],
        buttons: ['a']
      }
    ]);
    expect(sentTo(sent, 1)).toEqual([
      { type: 'button', button: 'a', pressed: true },
      { type: 'move', axis: 'x', direction: 'positive', angle: 30 },
      { type: 'move', axis: 'y', direction: 'negative', angle: -30 },
      { type: 'move', axis: 'z', direction: 'positive', angle: 40 }
    ]);
  });

  it('emits button transitions once, including stick clicks and multiple buttons', () => {
    const { fake, sent } = createJoycon();

    fake.emit({ ...reportAt(0), buttons: ['up', 'lstick'] });
    fake.emit({ ...reportAt(0), buttons: ['up', 'lstick'] });
    fake.emit({ ...reportAt(0), buttons: ['lstick', 'zl'] });
    fake.emit(reportAt(0));

    expect(sentTo(sent, 1)).toEqual([
      { type: 'button', button: 'up', pressed: true },
      { type: 'button', button: 'lstick', pressed: true },
      { type: 'button', button: 'up', pressed: false },
      { type: 'button', button: 'zl', pressed: true },
      { type: 'button', button: 'lstick', pressed: false },
      { type: 'button', button: 'zl', pressed: false }
    ]);
  });

  it('releases held buttons on disconnect and detects presses after reconnect', () => {
    const { fake, sent } = createJoycon();

    fake.emit({ ...reportAt(0), buttons: ['left'] });
    fake.setDevices([]);
    fake.setDevices([LEFT_JOYCON]);
    fake.emit({ ...reportAt(0), buttons: ['left'] });

    expect(sentTo(sent, 1)).toEqual([
      { type: 'button', button: 'left', pressed: true },
      { type: 'button', button: 'left', pressed: false },
      { type: 'disconnected', side: 'left' },
      { type: 'connected', side: 'left', label: 'Joy-Con (L)' },
      { type: 'button', button: 'left', pressed: true }
    ]);
  });

  it('emits connection events when the matching Joy-Con comes and goes', () => {
    const { fake, sent } = createJoycon([]);

    fake.setDevices([LEFT_JOYCON]);
    fake.setDevices([]);

    expect(sentTo(sent, 1)).toEqual([
      { type: 'connected', side: 'left', label: 'Joy-Con (L)' },
      { type: 'disconnected', side: 'left' }
    ]);
  });

  it('ignores Joy-Cons that do not match the device filter', () => {
    const { object, fake, sent, values } = createJoycon([]);

    values.device = 'right';
    object.update();

    fake.setDevices([LEFT_JOYCON]);

    expect(sent).toEqual([]);
  });

  it('stores the threshold from setThreshold', () => {
    const { object, values } = createJoycon();

    object.onMessage({ type: 'setThreshold', value: 30 });

    expect(values.threshold).toBe(30);
  });

  it('disconnects the matching Joy-Con', () => {
    const { object, fake } = createJoycon();

    object.onMessage({ type: 'disconnect' });

    expect(fake.system.disconnect).toHaveBeenCalledWith('joycon-node');
  });

  it('stops receiving reports after destroy', () => {
    const { object, fake } = createJoycon();

    object.destroy();

    expect(fake.subscriber).toBeNull();
  });

  it('releases held buttons when the node is destroyed', () => {
    const { object, fake, sent } = createJoycon();

    fake.emit({ ...reportAt(0), buttons: ['lstick'] });
    object.destroy();

    expect(sentTo(sent, 1)).toEqual([
      { type: 'button', button: 'lstick', pressed: true },
      { type: 'button', button: 'lstick', pressed: false }
    ]);
  });

  it('resolves edge messages sent through the message-in handle', () => {
    const resolved = resolveMessageInlet(JoyconObject.inlets, {
      source: 'msg-1',
      inletKey: 'message-in',
      outletKey: 'message-out'
    });

    expect(resolved).toEqual({ inlet: 0, inletName: 'control' });
  });
});
