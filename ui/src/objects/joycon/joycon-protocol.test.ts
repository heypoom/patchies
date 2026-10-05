import { describe, expect, it } from 'vitest';

import { buildSubcommand, parseFullInputReport } from './joycon-protocol';

/** Build a 0x30 report payload (without report ID) with the given IMU frames. */
function createReport(options: { buttons?: [number, number, number]; imu: number[][] }) {
  const data = new DataView(new ArrayBuffer(48));
  const [right, shared, left] = options.buttons ?? [0, 0, 0];

  data.setUint8(1, 0x80);
  data.setUint8(2, right);
  data.setUint8(3, shared);
  data.setUint8(4, left);

  options.imu.forEach((frame, frameIndex) => {
    frame.forEach((value, i) => data.setInt16(12 + frameIndex * 12 + i * 2, value, true));
  });

  return data;
}

describe('joycon protocol', () => {
  it('builds subcommand payloads with neutral rumble and a 4-bit counter', () => {
    expect([...buildSubcommand(0x13, 0x40, [0x01])]).toEqual([
      0x03, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40, 0x40, 0x01
    ]);
  });

  it('parses three IMU frames into g and degrees per second', () => {
    const report = parseFullInputReport(
      createReport({
        imu: [
          [4096, 0, -4096, 1000, 0, -1000],
          [0, 4096, 0, 0, 0, 0],
          [0, 0, 4096, 0, 2000, 0]
        ]
      })
    );

    expect(report?.samples).toHaveLength(3);
    expect(report?.samples[0].accel[0]).toBeCloseTo(1, 2);
    expect(report?.samples[0].accel[2]).toBeCloseTo(-1, 2);
    expect(report?.samples[0].gyro[0]).toBeCloseTo(61.03, 1);
    expect(report?.samples[2].gyro[1]).toBeCloseTo(122.06, 1);
  });

  it('reports pressed buttons and battery level', () => {
    const report = parseFullInputReport(
      createReport({ buttons: [0b1000_0001, 0b0001_0000, 0b1100_0000], imu: [] })
    );

    expect(report?.buttons).toEqual(['y', 'zr', 'home', 'l', 'zl']);
    expect(report?.battery).toBe(4);
  });

  it('rejects truncated reports', () => {
    expect(parseFullInputReport(new DataView(new ArrayBuffer(20)))).toBeNull();
  });
});
