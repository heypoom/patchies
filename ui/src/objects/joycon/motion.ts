import type { JoyconAxis, MotionDirection } from './constants';
import { IMU_SAMPLE_INTERVAL, type ImuSample, type Vec3 } from './joycon-protocol';

export interface MotionSettings {
  /** Angle in degrees that counts as a positive or negative move. */
  threshold: number;
}

export interface MotionChange {
  axis: JoyconAxis;
  direction: MotionDirection;
  angle: number;
}

export interface MotionState {
  /** Independent device-axis estimates relative to neutral, in degrees. */
  angles: Vec3;
  directions: [MotionDirection, MotionDirection, MotionDirection];
  changes: MotionChange[];
  calibrating: boolean;
}

const AXIS_INDEX: Record<JoyconAxis, number> = { x: 0, y: 1, z: 2 };
const AXES: JoyconAxis[] = ['x', 'y', 'z'];

const CALIBRATION_SAMPLES = 30;

/** Minimum gravity component (in g) in an axis' rotation plane to trust accel there. */
const MIN_PLANE_GRAVITY = 0.5;

/** Time constant (s) for pulling the gyro-integrated angle toward the accel angle. */
const ACCEL_CORRECTION_TAU = 0.5;

/** Time constant (s) for low-pass filtering accel. */
const ACCEL_LOWPASS_TAU = 0.05;

const SIGN_LEARN_MIN_RATE = 30;
const SIGN_LEARN_CONFIDENCE = 500;

const HYSTERESIS_DEGREES = 5;

const RAD_TO_DEG = 180 / Math.PI;

/** Estimates all three device-axis angles and detects threshold crossings independently. */
export class MotionTracker {
  private settings: MotionSettings;

  private calibrationLeft = CALIBRATION_SAMPLES;
  private calibrationSum: Vec3 = [0, 0, 0];

  private neutralGravity: Vec3 = [0, 0, 1];
  private filteredAccel: Vec3 = [0, 0, 1];

  private angles: Vec3 = [0, 0, 0];
  private previousAccelAngles: Vec3 = [0, 0, 0];
  private gyroSigns: Vec3 = [1, 1, 1];
  private signEvidence: Vec3 = [0, 0, 0];
  private directions: [MotionDirection, MotionDirection, MotionDirection] = [
    'neutral',
    'neutral',
    'neutral'
  ];

  constructor(settings: MotionSettings) {
    this.settings = { ...settings };
  }

  configure(settings: Partial<MotionSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /** Capture the next few samples as the neutral pose. */
  calibrate(): void {
    this.calibrationLeft = CALIBRATION_SAMPLES;
    this.calibrationSum = [0, 0, 0];
  }

  update(sample: ImuSample, dt = IMU_SAMPLE_INTERVAL): MotionState {
    if (this.calibrationLeft > 0) {
      this.collectCalibration(sample.accel);

      return this.toState([], true);
    }

    this.filteredAccel = lerpVec(
      this.filteredAccel,
      sample.accel,
      smoothing(dt, ACCEL_LOWPASS_TAU)
    );

    for (const axis of AXES) {
      this.updateAxis(AXIS_INDEX[axis], sample.gyro, dt);
    }

    const changes: MotionChange[] = [];

    for (const axis of AXES) {
      const index = AXIS_INDEX[axis];
      const angle = this.angles[index];
      const direction = this.nextDirection(angle, this.directions[index]);

      if (direction !== this.directions[index]) {
        this.directions[index] = direction;
        changes.push({ axis, direction, angle });
      }
    }

    return this.toState(changes, false);
  }

  private collectCalibration(accel: Vec3): void {
    this.calibrationSum = addVec(this.calibrationSum, accel);
    this.calibrationLeft--;

    if (this.calibrationLeft > 0) return;

    this.neutralGravity = scaleVec(this.calibrationSum, 1 / CALIBRATION_SAMPLES);
    this.filteredAccel = [...this.neutralGravity];
    this.angles = [0, 0, 0];
    this.previousAccelAngles = [0, 0, 0];
    this.directions = ['neutral', 'neutral', 'neutral'];
    this.gyroSigns = [1, 1, 1];
    this.signEvidence = [0, 0, 0];
  }

  private updateAxis(index: number, gyro: Vec3, dt: number): void {
    const rate = gyro[index];
    const reliable = this.isReliableAxis(index, this.filteredAccel);

    // Gravity rotates opposite to the device, so negate to get device rotation.
    const accelAngle = -signedAngleAround(index, this.neutralGravity, this.filteredAccel);

    if (reliable && Math.abs(rate) > SIGN_LEARN_MIN_RATE) {
      this.signEvidence[index] += rate * (accelAngle - this.previousAccelAngles[index]);

      if (Math.abs(this.signEvidence[index]) > SIGN_LEARN_CONFIDENCE) {
        this.gyroSigns[index] = Math.sign(this.signEvidence[index]);
      }
    }

    this.angles[index] += this.gyroSigns[index] * rate * dt;

    if (reliable) {
      this.angles[index] += (accelAngle - this.angles[index]) * smoothing(dt, ACCEL_CORRECTION_TAU);
    }

    this.previousAccelAngles[index] = accelAngle;
  }

  private isReliableAxis(index: number, accel: Vec3): boolean {
    const neutral = planeMagnitude(index, this.neutralGravity);

    return neutral >= MIN_PLANE_GRAVITY && planeMagnitude(index, accel) >= MIN_PLANE_GRAVITY;
  }

  private nextDirection(angle: number, current: MotionDirection): MotionDirection {
    const { threshold } = this.settings;
    const release = Math.max(threshold - HYSTERESIS_DEGREES, threshold / 2);

    let next = current;

    if (next === 'positive' && angle < release) next = 'neutral';
    if (next === 'negative' && angle > -release) next = 'neutral';

    if (next === 'neutral') {
      if (angle > threshold) next = 'positive';
      else if (angle < -threshold) next = 'negative';
    }

    return next;
  }

  private toState = (changes: MotionChange[], calibrating: boolean): MotionState => ({
    angles: calibrating ? [0, 0, 0] : [...this.angles],
    directions: [...this.directions],
    changes,
    calibrating
  });
}

/** The two other components of a vector, in right-handed order around `index`. */
const planeComponents = (index: number, v: Vec3): [number, number] => [
  v[(index + 1) % 3],
  v[(index + 2) % 3]
];

const planeMagnitude = (index: number, v: Vec3) => Math.hypot(...planeComponents(index, v));

/** Signed angle in degrees from `from` to `to`, measured around device axis `index`. */
function signedAngleAround(index: number, from: Vec3, to: Vec3): number {
  const [a1, a2] = planeComponents(index, from);
  const [b1, b2] = planeComponents(index, to);

  return Math.atan2(a1 * b2 - a2 * b1, a1 * b1 + a2 * b2) * RAD_TO_DEG;
}

const smoothing = (dt: number, tau: number) => dt / (tau + dt);

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const scaleVec = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];
