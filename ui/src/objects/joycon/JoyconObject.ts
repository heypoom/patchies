import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, messages } from '$lib/objects/schemas/common';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

import { DEFAULT_JOYCON_DATA, type JoyconDeviceFilter, type JoyconNodeData } from './constants';
import type { JoyconInputReport } from './joycon-protocol';
import { clearJoyconReading, setJoyconReading } from './joycon-live';
import { LegMotionTracker } from './leg-motion';
import { JoyconSystem, type JoyconDeviceInfo } from './JoyconSystem';

const Vec3Schema = Type.Tuple([Type.Number(), Type.Number(), Type.Number()]);
const SideSchema = Type.Union([Type.Literal('left'), Type.Literal('right')]);

export const JoyconConnect = sym('connect');
export const JoyconDisconnect = sym('disconnect');
export const JoyconCalibrate = sym('calibrate');
export const JoyconSetThreshold = msg('setThreshold', { value: Type.Number() });

export const JoyconMotion = msg('motion', {
  side: SideSchema,
  accel: Vec3Schema,
  gyro: Vec3Schema,
  angle: Type.Number(),
  axis: Type.Union([Type.Literal('x'), Type.Literal('y'), Type.Literal('z')]),
  buttons: Type.Array(Type.String())
});

export const JoyconMove = msg('move', {
  direction: Type.Union([
    Type.Literal('forward'),
    Type.Literal('backward'),
    Type.Literal('neutral')
  ]),
  angle: Type.Number()
});

export const JoyconConnected = msg('connected', { side: SideSchema, label: Type.String() });
export const JoyconDisconnected = msg('disconnected', { side: SideSchema });

const joyconMessages = {
  connect: schema(JoyconConnect),
  disconnect: schema(JoyconDisconnect),
  calibrate: schema(JoyconCalibrate),
  setThreshold: schema(JoyconSetThreshold)
};

export type JoyconSystemLike = Pick<
  JoyconSystem,
  'subscribe' | 'getAssignedDevice' | 'restoreGrantedDevices' | 'disconnect'
>;

const RAW_OUTLET = 0;
const EVENT_OUTLET = 1;

export class JoyconObject implements TextObjectV2 {
  static type = 'joycon';
  static category = 'network';
  static description =
    'Nintendo Switch Joy-Con over WebHID: raw motion data and forward/backward leg swing detection';
  static tags = ['joycon', 'nintendo', 'switch', 'hid', 'imu', 'motion', 'gyro', 'leg', 'fitness'];

  static inlets: ObjectInlet[] = [
    {
      name: 'control',
      description: 'Connection and calibration commands',
      messages: [
        { schema: Bang, description: 'Reconnect Joy-Cons the browser already granted' },
        { schema: JoyconConnect, description: 'Reconnect Joy-Cons the browser already granted' },
        { schema: JoyconDisconnect, description: 'Disconnect the Joy-Con' },
        { schema: JoyconCalibrate, description: 'Capture the current pose as neutral' },
        { schema: JoyconSetThreshold, description: 'Set the swing threshold in degrees' }
      ],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'raw',
      description: 'Raw motion data at about 60 Hz',
      messages: [
        {
          schema: JoyconMotion,
          description: 'Accel in g, gyro in deg/s, swing angle in degrees, pressed buttons'
        }
      ],
      handle: { handleType: 'message', handleId: 0 }
    },
    {
      name: 'events',
      description: 'Leg movement and connection events',
      messages: [
        { schema: JoyconMove, description: 'Leg swing direction changed' },
        { schema: JoyconConnected, description: 'Joy-Con connected' },
        { schema: JoyconDisconnected, description: 'Joy-Con disconnected' }
      ],
      handle: { handleType: 'message', handleId: 1 }
    }
  ];

  private tracker: LegMotionTracker | null = null;
  private unsubscribe: (() => void) | null = null;
  private device: JoyconDeviceInfo | undefined;
  private subscribedFilter: JoyconDeviceFilter | null = null;

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext,
    private readonly system: JoyconSystemLike = JoyconSystem.getInstance()
  ) {}

  create(): void {
    const data = this.getData();

    this.tracker = new LegMotionTracker(data);
    this.subscribedFilter = data.device;

    this.unsubscribe = this.system.subscribe({
      nodeId: this.nodeId,
      device: data.device,
      onReport: (report) => this.handleReport(report),
      onDevicesChange: () => this.syncDevice()
    });

    this.syncDevice();
    this.reconnect();
  }

  update(): void {
    const data = this.getData();

    this.tracker?.configure(data);

    // The device filter is read at subscribe time, so resubscribe when it changes.
    if (this.unsubscribe && data.device !== this.subscribedFilter) {
      this.destroy();
      this.create();
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.tracker = null;
    this.device = undefined;
    this.subscribedFilter = null;

    clearJoyconReading(this.nodeId);
  }

  onMessage(data: unknown): void {
    match(data)
      .with(messages.bang, () => this.reconnect())
      .with(joyconMessages.connect, () => this.reconnect())
      .with(joyconMessages.disconnect, () => {
        this.system.disconnect(this.nodeId);
      })
      .with(joyconMessages.calibrate, () => this.tracker?.calibrate())
      .with(joyconMessages.setThreshold, ({ value }) => {
        this.context.setData({ threshold: value }, { notifyUI: true });
        this.tracker?.configure({ threshold: value });
      })
      .otherwise(() => {});
  }

  private handleReport(report: JoyconInputReport): void {
    const tracker = this.tracker;
    if (!tracker || !this.device) return;

    let state = null;

    for (const sample of report.samples) {
      state = tracker.update(sample);

      if (state.changed) {
        this.context.send(
          { type: 'move', direction: state.direction, angle: state.angle },
          { to: EVENT_OUTLET }
        );
      }
    }

    const latest = report.samples[report.samples.length - 1];
    if (!state || !latest) return;

    setJoyconReading(this.nodeId, { ...latest, ...state });

    this.context.send(
      {
        type: 'motion',
        side: this.device.side,
        accel: latest.accel,
        gyro: latest.gyro,
        angle: state.angle,
        axis: state.axis,
        buttons: report.buttons
      },
      { to: RAW_OUTLET }
    );
  }

  private syncDevice(): void {
    const previous = this.device;
    const next = this.system.getAssignedDevice(this.nodeId);

    if (previous?.id === next?.id) return;

    this.device = next;
    clearJoyconReading(this.nodeId);

    if (previous) {
      this.context.send({ type: 'disconnected', side: previous.side }, { to: EVENT_OUTLET });
    }

    if (next) {
      this.tracker?.calibrate();
      this.context.send(
        { type: 'connected', side: next.side, label: next.label },
        { to: EVENT_OUTLET }
      );
    }
  }

  private reconnect(): void {
    this.system.restoreGrantedDevices().catch((error) => {
      console.warn('[joycon] failed to reconnect granted Joy-Cons', error);
    });
  }

  private getData = (): JoyconNodeData => ({
    ...DEFAULT_JOYCON_DATA,
    ...this.context.getData<Partial<JoyconNodeData>>()
  });
}
