import { describe, expect, it } from 'vitest';

import { LegMotionTracker, type LegMotionSettings, type LegMotionState } from './leg-motion';
import { IMU_SAMPLE_INTERVAL, type Vec3 } from './joycon-protocol';

const GRAVITY_ALONG_Y: Vec3 = [0, 1, 0];

const DEFAULT_SETTINGS: LegMotionSettings = { axis: 'auto', invert: false, threshold: 20 };

/**
 * Simulates a Joy-Con rotating around one device axis, producing the gravity
 * reading and gyro rate a real sensor would report.
 */
function createLeg(options: { axis: number; gyroSign?: number; gravity?: Vec3 }) {
  const { axis, gyroSign = 1, gravity = GRAVITY_ALONG_Y } = options;

  let angle = 0;

  const sampleAt = (rate: number) => ({
    accel: rotate(gravity, axis, -angle),
    gyro: withComponent(axis, rate * gyroSign)
  });

  return {
    hold(tracker: LegMotionTracker, seconds: number): LegMotionState[] {
      const states: LegMotionState[] = [];

      for (let t = 0; t < seconds; t += IMU_SAMPLE_INTERVAL) {
        states.push(tracker.update(sampleAt(0)));
      }

      return states;
    },

    swingTo(tracker: LegMotionTracker, target: number, seconds = 0.3): LegMotionState[] {
      const steps = Math.round(seconds / IMU_SAMPLE_INTERVAL);
      const rate = (target - angle) / seconds;
      const states: LegMotionState[] = [];

      for (let i = 0; i < steps; i++) {
        angle += rate * IMU_SAMPLE_INTERVAL;
        states.push(tracker.update(sampleAt(rate)));
      }

      return states;
    }
  };
}

const createTracker = (settings: Partial<LegMotionSettings> = {}) =>
  new LegMotionTracker({ ...DEFAULT_SETTINGS, ...settings });

const last = (states: LegMotionState[]) => states[states.length - 1];

const directionEvents = (states: LegMotionState[]) =>
  states.filter((state) => state.changed).map((state) => state.direction);

describe('LegMotionTracker', () => {
  it('reports neutral while calibrating', () => {
    const tracker = createTracker();
    const leg = createLeg({ axis: 0 });

    const states = leg.hold(tracker, 0.1);

    expect(states.every((state) => state.calibrating)).toBe(true);
    expect(last(states).direction).toBe('neutral');
  });

  it('detects forward and backward swings around the swing axis', () => {
    const tracker = createTracker();
    const leg = createLeg({ axis: 0 });

    leg.hold(tracker, 0.2);

    const forward = [...leg.swingTo(tracker, 35), ...leg.hold(tracker, 1.5)];

    expect(last(forward).angle).toBeCloseTo(35, 0);
    expect(directionEvents(forward)).toEqual(['forward']);

    const back = [...leg.swingTo(tracker, -35, 0.6), ...leg.hold(tracker, 1.5)];

    expect(last(back).angle).toBeCloseTo(-35, 0);
    expect(directionEvents(back)).toEqual(['neutral', 'backward']);

    const neutral = [...leg.swingTo(tracker, 0), ...leg.hold(tracker, 0.3)];

    expect(directionEvents(neutral)).toEqual(['neutral']);
  });

  it('ignores swings below the threshold', () => {
    const tracker = createTracker({ threshold: 25 });
    const leg = createLeg({ axis: 0 });

    leg.hold(tracker, 0.2);

    const states = [...leg.swingTo(tracker, 15), ...leg.hold(tracker, 0.3)];

    expect(directionEvents(states)).toEqual([]);
  });

  it('flips the direction when inverted', () => {
    const tracker = createTracker({ invert: true });
    const leg = createLeg({ axis: 0 });

    leg.hold(tracker, 0.2);

    const states = [...leg.swingTo(tracker, 35), ...leg.hold(tracker, 0.3)];

    expect(directionEvents(states)).toEqual(['backward']);
  });

  it('picks the axis with the most swing motion in auto mode', () => {
    const tracker = createTracker();
    const leg = createLeg({ axis: 2 });

    leg.hold(tracker, 0.2);

    const states = [...leg.swingTo(tracker, 35), ...leg.hold(tracker, 0.3)];

    expect(last(states).axis).toBe('z');
    expect(directionEvents(states)).toEqual(['forward']);
  });

  it('measures around a pinned axis', () => {
    const tracker = createTracker({ axis: 'x' });
    const leg = createLeg({ axis: 2 });

    leg.hold(tracker, 0.2);

    const states = [...leg.swingTo(tracker, 35), ...leg.hold(tracker, 0.3)];

    expect(last(states).axis).toBe('x');
    expect(directionEvents(states)).toEqual([]);
  });

  it('learns a reversed gyro axis from the accelerometer', () => {
    const tracker = createTracker();
    const leg = createLeg({ axis: 0, gyroSign: -1 });

    leg.hold(tracker, 0.2);
    leg.swingTo(tracker, 35);
    leg.swingTo(tracker, 0);

    const states = [...leg.swingTo(tracker, 35, 0.15), ...leg.hold(tracker, 0.05)];

    expect(last(states).angle).toBeGreaterThan(25);
    expect(directionEvents(states)).toEqual(['forward']);
  });

  it('uses the current pose as neutral after recalibrating', () => {
    const tracker = createTracker();
    const leg = createLeg({ axis: 0 });

    leg.hold(tracker, 0.2);
    leg.swingTo(tracker, 35);
    leg.hold(tracker, 0.3);

    tracker.calibrate();

    const states = leg.hold(tracker, 0.3);

    expect(last(states).angle).toBeCloseTo(0, 1);
    expect(last(states).direction).toBe('neutral');
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
