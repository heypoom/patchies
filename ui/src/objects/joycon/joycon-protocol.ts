/**
 * Joy-Con Bluetooth HID protocol helpers.
 *
 * Based on dekuNukem/Nintendo_Switch_Reverse_Engineering. WebHID strips the
 * report ID from both input and output reports, so offsets here are one less
 * than in the reference tables.
 */

export type Vec3 = [number, number, number];

export interface ImuSample {
  /** Acceleration in g. */
  accel: Vec3;

  /** Angular velocity in degrees per second. */
  gyro: Vec3;
}

export interface JoyconInputReport {
  /** Battery level from 0 (empty) to 4 (full). */
  battery: number;

  /** Names of currently pressed buttons. */
  buttons: string[];

  /** Three IMU samples, 5ms apart, oldest first. */
  samples: ImuSample[];
}

export const OUTPUT_REPORT_ID = 0x01;
export const FULL_INPUT_REPORT_ID = 0x30;

export const SUBCOMMAND_SET_INPUT_MODE = 0x03;
export const SUBCOMMAND_SET_PLAYER_LIGHTS = 0x30;
export const SUBCOMMAND_ENABLE_IMU = 0x40;

export const INPUT_MODE_STANDARD_FULL = 0x30;

/** Seconds between IMU samples inside one input report. */
export const IMU_SAMPLE_INTERVAL = 0.005;

const ACCEL_G_PER_LSB = 0.000244;
const GYRO_DPS_PER_LSB = 0.06103;

const NEUTRAL_RUMBLE = [0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40];

const IMU_OFFSET = 12;
const IMU_FRAME_SIZE = 12;
const IMU_FRAME_COUNT = 3;

const RIGHT_BUTTONS = ['y', 'x', 'b', 'a', 'sr', 'sl', 'r', 'zr'];
const SHARED_BUTTONS = ['minus', 'plus', 'rstick', 'lstick', 'home', 'capture', '', ''];
const LEFT_BUTTONS = ['down', 'up', 'right', 'left', 'sr', 'sl', 'l', 'zl'];

/**
 * Build the payload of output report 0x01 carrying a subcommand.
 */
export const buildSubcommand = (
  counter: number,
  subcommand: number,
  args: number[] = []
): Uint8Array<ArrayBuffer> =>
  new Uint8Array([counter & 0x0f, ...NEUTRAL_RUMBLE, subcommand, ...args]);

/**
 * Parse the payload of standard full input report 0x30.
 */
export function parseFullInputReport(data: DataView): JoyconInputReport | null {
  if (data.byteLength < IMU_OFFSET + IMU_FRAME_SIZE * IMU_FRAME_COUNT) return null;

  const samples: ImuSample[] = [];

  for (let frame = 0; frame < IMU_FRAME_COUNT; frame++) {
    const offset = IMU_OFFSET + frame * IMU_FRAME_SIZE;
    const read = (index: number) => data.getInt16(offset + index * 2, true);

    samples.push({
      accel: [read(0) * ACCEL_G_PER_LSB, read(1) * ACCEL_G_PER_LSB, read(2) * ACCEL_G_PER_LSB],
      gyro: [read(3) * GYRO_DPS_PER_LSB, read(4) * GYRO_DPS_PER_LSB, read(5) * GYRO_DPS_PER_LSB]
    });
  }

  return {
    battery: data.getUint8(1) >> 5,
    buttons: [
      ...readButtons(data.getUint8(2), RIGHT_BUTTONS),
      ...readButtons(data.getUint8(3), SHARED_BUTTONS),
      ...readButtons(data.getUint8(4), LEFT_BUTTONS)
    ],
    samples
  };
}

function readButtons(byte: number, names: string[]): string[] {
  const pressed: string[] = [];

  names.forEach((name, bit) => {
    if (name && byte & (1 << bit)) pressed.push(name);
  });

  return pressed;
}
