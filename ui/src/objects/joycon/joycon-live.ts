import type { JoyconAxis, LegDirection } from './constants';
import type { Vec3 } from './joycon-protocol';

/** Latest reading of a `joycon` object, polled by its view each animation frame. */
export interface JoyconLiveReading {
  accel: Vec3;
  gyro: Vec3;
  angle: number;
  axis: JoyconAxis;
  direction: LegDirection;
  calibrating: boolean;
}

// Readings arrive at ~60 Hz; a plain map avoids pushing them through node data.
const readings = new Map<string, JoyconLiveReading>();

export const setJoyconReading = (nodeId: string, reading: JoyconLiveReading) =>
  readings.set(nodeId, reading);

export const getJoyconReading = (nodeId: string) => readings.get(nodeId);

export const clearJoyconReading = (nodeId: string) => readings.delete(nodeId);
