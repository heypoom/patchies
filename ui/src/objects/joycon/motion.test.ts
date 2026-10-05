import { describe, expect, it } from 'vitest';

import { MotionTracker, type MotionSettings, type MotionState } from './motion';
import { IMU_SAMPLE_INTERVAL, type Vec3 } from './joycon-protocol';

const GRAVITY_ALONG_Y: Vec3 = [0, 1, 0];

const DEFAULT_SETTINGS: MotionSettings = { threshold: 20 };

/**
 * Simulates a Joy-Con rotating around one device axis, producing the gravity
 * reading and gyro rate a real sensor would report.
 */
function createController(options: { axis: number; gyroSign?: number; gravity?: Vec3 }) {
  const { axis, gyroSign = 1, gravity = GRAVITY_ALONG_Y } = options;

  let angle = 0;

  const sampleAt = (rate: number) => ({
    accel: rotate(gravity, axis, -angle),
    gyro: withComponent(axis, rate * gyroSign)
  });

  return {
    hold(tracker: MotionTracker, seconds: number): MotionState[] {
      const states: MotionState[] = [];

      for (let t = 0; t < seconds; t += IMU_SAMPLE_INTERVAL) {
        states.push(tracker.update(sampleAt(0)));
      }

      return states;
    },

    rotateTo(tracker: MotionTracker, target: number, seconds = 0.3): MotionState[] {
      const steps = Math.round(seconds / IMU_SAMPLE_INTERVAL);
      const rate = (target - angle) / seconds;
      const states: MotionState[] = [];

      for (let i = 0; i < steps; i++) {
        angle += rate * IMU_SAMPLE_INTERVAL;
        states.push(tracker.update(sampleAt(rate)));
      }

      return states;
    }
  };
}

const createTracker = (settings: Partial<MotionSettings> = {}) =>
  new MotionTracker({ ...DEFAULT_SETTINGS, ...settings });

const last = (states: MotionState[]) => states[states.length - 1];

const directionEvents = (states: MotionState[]) =>
  states.flatMap((state) => state.changes.map((change) => change.direction));

describe('MotionTracker', () => {
  it('reports neutral while calibrating', () => {
    const tracker = createTracker();
    const controller = createController({ axis: 0 });

    const states = controller.hold(tracker, 0.1);

    expect(states.every((state) => state.calibrating)).toBe(true);
    expect(last(states).directions).toEqual(['neutral', 'neutral', 'neutral']);
  });

  it.each([0, 1, 2])('exposes the angle around device axis %i', (axis) => {
    const tracker = createTracker();
    const gravity: Vec3 = axis === 1 ? [0, 0, 1] : GRAVITY_ALONG_Y;
    const controller = createController({ axis, gravity });

    controller.hold(tracker, 0.2);

    const states = [...controller.rotateTo(tracker, 35), ...controller.hold(tracker, 1.5)];
    const angles = last(states).angles;

    expect(angles[axis]).toBeCloseTo(35, 0);
    expect(angles[(axis + 1) % 3]).toBeCloseTo(0, 0);
    expect(angles[(axis + 2) % 3]).toBeCloseTo(0, 0);
  });

  it('detects positive and negative rotation around an axis', () => {
    const tracker = createTracker();
    const controller = createController({ axis: 0 });

    controller.hold(tracker, 0.2);

    const positive = [...controller.rotateTo(tracker, 35), ...controller.hold(tracker, 1.5)];

    expect(last(positive).angles[0]).toBeCloseTo(35, 0);
    expect(directionEvents(positive)).toEqual(['positive']);

    const negative = [...controller.rotateTo(tracker, -35, 0.6), ...controller.hold(tracker, 1.5)];

    expect(last(negative).angles[0]).toBeCloseTo(-35, 0);
    expect(directionEvents(negative)).toEqual(['neutral', 'negative']);

    const neutral = [...controller.rotateTo(tracker, 0), ...controller.hold(tracker, 0.3)];

    expect(directionEvents(neutral)).toEqual(['neutral']);
  });

  it('ignores motion below the threshold', () => {
    const tracker = createTracker({ threshold: 25 });
    const controller = createController({ axis: 0 });

    controller.hold(tracker, 0.2);

    const states = [...controller.rotateTo(tracker, 15), ...controller.hold(tracker, 0.3)];

    expect(directionEvents(states)).toEqual([]);
  });

  it('detects threshold crossings on all axes in the same sample', () => {
    const tracker = createTracker();

    for (let i = 0; i < 30; i++) {
      tracker.update({ accel: [0, 0, 0], gyro: [0, 0, 0] });
    }

    const state = tracker.update({ accel: [0, 0, 0], gyro: [300, -300, 400] }, 0.1);

    expect(state.angles).toEqual([30, -30, 40]);
    expect(state.changes).toEqual([
      { axis: 'x', direction: 'positive', angle: 30 },
      { axis: 'y', direction: 'negative', angle: -30 },
      { axis: 'z', direction: 'positive', angle: 40 }
    ]);

    const held = tracker.update({ accel: [0, 0, 0], gyro: [0, 0, 0] });

    expect(held.changes).toEqual([]);

    const returned = tracker.update({ accel: [0, 0, 0], gyro: [-200, 0, -400] }, 0.1);

    expect(returned.angles).toEqual([10, -30, 0]);
    expect(returned.directions).toEqual(['neutral', 'negative', 'neutral']);
    expect(returned.changes).toEqual([
      { axis: 'x', direction: 'neutral', angle: 10 },
      { axis: 'z', direction: 'neutral', angle: 0 }
    ]);

    expect(state.angles).toEqual([30, -30, 40]);
  });

  it('learns a reversed gyro axis from the accelerometer', () => {
    const tracker = createTracker();
    const controller = createController({ axis: 0, gyroSign: -1 });

    controller.hold(tracker, 0.2);
    controller.rotateTo(tracker, 35);
    controller.rotateTo(tracker, 0);

    const states = [...controller.rotateTo(tracker, 35, 0.15), ...controller.hold(tracker, 0.05)];

    expect(last(states).angles[0]).toBeGreaterThan(25);
    expect(directionEvents(states)).toEqual(['positive']);
  });

  it('uses the current pose as neutral after recalibrating', () => {
    const tracker = createTracker();
    const controller = createController({ axis: 0 });

    controller.hold(tracker, 0.2);
    controller.rotateTo(tracker, 35);
    controller.hold(tracker, 0.3);

    tracker.calibrate();

    const states = controller.hold(tracker, 0.3);

    expect(last(states).angles[0]).toBeCloseTo(0, 1);
    expect(last(states).directions).toEqual(['neutral', 'neutral', 'neutral']);
  });
});

function rotate(v: Vec3, axis: number, degrees: number): Vec3 {
  const radians = (degrees * Math.PI) / 180;
  const i1 = (axis + 1) % 3;
  const i2 = (axis + 2) % 3;

  const result: Vec3 = [...v];

  result[i1] = v[i1] * Math.cos(radians) - v[i2] * Math.sin(radians);
  result[i2] = v[i1] * Math.sin(radians) + v[i2] * Math.cos(radians);

  return result;
}

function withComponent(axis: number, value: number): Vec3 {
  const result: Vec3 = [0, 0, 0];

  result[axis] = value;

  return result;
}
