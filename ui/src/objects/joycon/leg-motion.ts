import type { JoyconAxis, JoyconAxisSetting, LegDirection } from './constants';
import { IMU_SAMPLE_INTERVAL, type ImuSample, type Vec3 } from './joycon-protocol';

export interface LegMotionSettings {
  axis: JoyconAxisSetting;
  invert: boolean;

  /** Swing angle in degrees that counts as a forward or backward move. */
  threshold: number;
}

export interface LegMotionState {
  /** Signed swing angle from the calibrated neutral pose, in degrees. */
  angle: number;

  /** Device axis the swing angle is measured around. */
  axis: JoyconAxis;

  direction: LegDirection;

  /** True when `direction` changed on this sample. */
  changed: boolean;

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

/** Time constant (s) for the per-axis gyro energy used by auto axis selection. */
const ENERGY_TAU = 1;

/** An axis needs this much more energy than the current one to take over. */
const AXIS_SWITCH_RATIO = 2;

const SIGN_LEARN_MIN_RATE = 30;
const SIGN_LEARN_CONFIDENCE = 500;

const HYSTERESIS_DEGREES = 5;

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Tracks the swing angle of a Joy-Con strapped to the thigh and turns it into
 * forward/backward/neutral leg movement.
 *
 * Each device axis keeps its own complementary-filtered angle, so the tracker
 * works regardless of how the Joy-Con sits in the strap.
 */
export class LegMotionTracker {
  private settings: LegMotionSettings;

  private calibrationLeft = CALIBRATION_SAMPLES;
  private calibrationSum: Vec3 = [0, 0, 0];

  private neutralGravity: Vec3 = [0, 0, 1];
  private filteredAccel: Vec3 = [0, 0, 1];

  private angles: Vec3 = [0, 0, 0];
  private previousAccelAngles: Vec3 = [0, 0, 0];
  private gyroSigns: Vec3 = [1, 1, 1];
  private signEvidence: Vec3 = [0, 0, 0];
  private energy: Vec3 = [0, 0, 0];

  private autoAxis: JoyconAxis | null = null;
  private direction: LegDirection = 'neutral';

  constructor(settings: LegMotionSettings) {
    this.settings = { ...settings };
  }

  configure(settings: Partial<LegMotionSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /** Capture the next few samples as the neutral standing pose. */
  calibrate(): void {
    this.calibrationLeft = CALIBRATION_SAMPLES;
    this.calibrationSum = [0, 0, 0];
  }

  update(sample: ImuSample, dt = IMU_SAMPLE_INTERVAL): LegMotionState {
    if (this.calibrationLeft > 0) {
      this.collectCalibration(sample.accel);

      return this.toState(0, false, true);
    }

    this.filteredAccel = lerpVec(
      this.filteredAccel,
      sample.accel,
      smoothing(dt, ACCEL_LOWPASS_TAU)
    );

    for (const axis of AXES) {
      this.updateAxis(AXIS_INDEX[axis], sample.gyro, dt);
    }

    const axis = this.resolveAxis();
    const sign = this.settings.invert ? -1 : 1;
    const angle = this.angles[AXIS_INDEX[axis]] * sign;

    const nextDirection = this.nextDirection(angle);
    const changed = nextDirection !== this.direction;

    this.direction = nextDirection;

    return this.toState(angle, changed, false);
  }

  private collectCalibration(accel: Vec3): void {
    this.calibrationSum = addVec(this.calibrationSum, accel);
    this.calibrationLeft--;

    if (this.calibrationLeft > 0) return;

    this.neutralGravity = scaleVec(this.calibrationSum, 1 / CALIBRATION_SAMPLES);
    this.filteredAccel = [...this.neutralGravity];
    this.angles = [0, 0, 0];
    this.previousAccelAngles = [0, 0, 0];
    this.direction = 'neutral';
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
    this.energy[index] = this.energy[index] * Math.exp(-dt / ENERGY_TAU) + rate * rate * dt;
  }

  private isReliableAxis(index: number, accel: Vec3): boolean {
    const neutral = planeMagnitude(index, this.neutralGravity);

    return neutral >= MIN_PLANE_GRAVITY && planeMagnitude(index, accel) >= MIN_PLANE_GRAVITY;
  }

  private resolveAxis(): JoyconAxis {
    if (this.settings.axis !== 'auto') return this.settings.axis;

    const candidates = AXES.filter(
      (axis) => planeMagnitude(AXIS_INDEX[axis], this.neutralGravity) >= MIN_PLANE_GRAVITY
    );

    if (candidates.length === 0) return this.autoAxis ?? 'x';

    const strongest = candidates.reduce((best, axis) =>
      this.energy[AXIS_INDEX[axis]] > this.energy[AXIS_INDEX[best]] ? axis : best
    );

    const current = this.autoAxis;

    const shouldSwitch =
      current === null ||
      !candidates.includes(current) ||
      this.energy[AXIS_INDEX[strongest]] > this.energy[AXIS_INDEX[current]] * AXIS_SWITCH_RATIO;

    if (shouldSwitch) this.autoAxis = strongest;

    return this.autoAxis ?? strongest;
  }

  private nextDirection(angle: number): LegDirection {
    const { threshold } = this.settings;
    const release = Math.max(threshold - HYSTERESIS_DEGREES, threshold / 2);

    let next = this.direction;

    if (next === 'forward' && angle < release) next = 'neutral';
    if (next === 'backward' && angle > -release) next = 'neutral';

    if (next === 'neutral') {
      if (angle > threshold) next = 'forward';
      else if (angle < -threshold) next = 'backward';
    }

    return next;
  }

  private toState = (angle: number, changed: boolean, calibrating: boolean): LegMotionState => ({
    angle,
    axis: this.settings.axis === 'auto' ? (this.autoAxis ?? 'x') : this.settings.axis,
    direction: this.direction,
    changed,
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
