import type { JoyconSide } from './constants';

export type Vec2 = [number, number];

export interface StickCalibration {
  center: Vec2;
  below: Vec2;
  above: Vec2;
}

export const DEFAULT_STICK_CALIBRATION: StickCalibration = {
  center: [2048, 2048],
  below: [2048, 2048],
  above: [2047, 2047]
};

/** Decode two 12-bit coordinates packed into three bytes. */
export const decodeStick = (data: DataView, offset: number): Vec2 => [
  data.getUint8(offset) | ((data.getUint8(offset + 1) & 0x0f) << 8),
  (data.getUint8(offset + 1) >> 4) | (data.getUint8(offset + 2) << 4)
];

export function parseStickCalibration(data: DataView, side: JoyconSide): StickCalibration | null {
  if (data.byteLength < 9) return null;

  const first = decodeStick(data, 0);
  const second = decodeStick(data, 3);
  const third = decodeStick(data, 6);
  const calibration =
    side === 'left'
      ? { above: first, center: second, below: third }
      : { center: first, below: second, above: third };

  for (let axis = 0; axis < 2; axis++) {
    const { center, below, above } = calibration;
    const valid =
      center[axis] > 0 &&
      center[axis] < 4095 &&
      below[axis] > 0 &&
      above[axis] > 0 &&
      center[axis] - below[axis] >= 0 &&
      center[axis] + above[axis] <= 4095;

    if (!valid) return null;
  }

  return calibration;
}

/** Apply asymmetric calibrated ranges, then a continuous 15% radial dead zone. */
export function normalizeStick(raw: Vec2, calibration: StickCalibration): Vec2 {
  const normalized = raw.map((value, axis) => {
    const delta = value - calibration.center[axis];
    const range = delta < 0 ? calibration.below[axis] : calibration.above[axis];

    return Math.max(-1, Math.min(1, delta / range));
  });

  const [x, y] = normalized;
  const magnitude = Math.hypot(x, y);
  const deadZone = 0.15;
  if (magnitude <= deadZone) return [0, 0];

  const scale = (Math.min(magnitude, 1) - deadZone) / ((1 - deadZone) * magnitude);

  return [x * scale, y * scale];
}
