# 188. Joy-Con Object

## Overview

`joycon` reads a Nintendo Switch Joy-Con over WebHID. It gives two outputs:

- Raw motion data: accelerometer, gyroscope, and pressed buttons.
- Leg swing events: `forward`, `backward`, and `neutral`. They are computed from the swing angle of a Joy-Con worn on the thigh, for example in the Ring Fit Adventure leg strap.

The runtime is headless, as described in `visual-object-headless-migration.md`. The Svelte node handles the browser device picker, the settings, and a live angle display.

## Independent Devices

Each node exclusively claims one connected Joy-Con matching its `device` filter.
`any` picks the first unclaimed controller. Existing assignments stay stable when
other nodes are added or removed. If all matching controllers are claimed, the
node stays disconnected until one becomes available. Deleting a node releases
its claim; changing its device filter releases and reassigns it. Disconnect closes
only that node’s assigned controller. Calibration, settings, readings, and output
remain independent per node. The view shows the runtime’s assigned controller.

## Hardware Protocol

- WebHID filters: vendor `0x057e`, product `0x2006` (left Joy-Con) and `0x2007` (right Joy-Con).
- Output report `0x01`: `[counter & 0x0f, 00 01 40 40 00 01 40 40, subcommand, ...args]`. The 8 bytes are neutral rumble.
- Init sequence:
  1. `0x40 0x01`: enable the IMU.
  2. `0x03 0x30`: switch to the standard full input mode (60 Hz).
  3. `0x30 <bits>`: set the player light.
- Input report `0x30` (WebHID `data` excludes the report ID):
  - `[1]`: battery (high nibble).
  - `[2..4]`: buttons (right, shared, left).
  - `[12..47]`: three IMU frames, 5 ms apart. Each frame has accel X/Y/Z, then gyro X/Y/Z, as int16 LE values.
- Scale factors: accel `0.000244 g/LSB`, gyro `0.06103 dps/LSB`.

## Leg Motion Tracking

`LegMotionTracker` turns IMU samples into a signed swing angle in degrees. It does not depend on how the Joy-Con sits in the strap:

1. **Calibrate:** the mean accel over the first 30 samples (150 ms) becomes the neutral gravity vector `g0`. This runs on connect and on a `calibrate` message.
2. **Per-axis angle:** for each device axis, a complementary filter combines:
   - the gyro rate integrated over 5 ms steps, and
   - the gravity rotation angle between `g0` and low-passed accel, projected on the plane normal to that axis.

   The accel correction is used only when gravity has a large enough component in that plane.

3. **Gyro sign learning:** the two Joy-Cons have one axis reversed. Each axis learns its gyro sign by correlating the gyro rate with the change of the accel angle.
4. **Auto axis:** the swing axis is the reliable axis with the most gyro energy. A switch needs 2x the current axis's energy (hysteresis). Users can pin `x`, `y`, or `z`.
5. **Direction:** the angle is multiplied by `-1` when `invert` is set.
   - Past `+threshold`: `forward`.
   - Past `-threshold`: `backward`.
   - Back inside `threshold - 5°`: `neutral`.

   Events fire only when the direction changes.

The sign of "forward" depends on the leg and the strap orientation. Users swing once and toggle `invert` if needed.

## Messages

Inlet:

| Message                         | Effect                                                 |
| ------------------------------- | ------------------------------------------------------ |
| `bang`, `{type: 'connect'}`     | Reconnect to Joy-Cons that the browser already granted |
| `{type: 'disconnect'}`          | Close the matching Joy-Con                             |
| `{type: 'calibrate'}`           | Capture the current pose as neutral                    |
| `{type: 'setThreshold', value}` | Set the swing threshold in degrees                     |

Outlet 0 (raw, ~60 Hz):

```ts
{ type: 'motion', side, accel: [x, y, z], gyro: [x, y, z], angle, axis, buttons: string[] }
```

Outlet 1 (events):

```ts
{ type: 'move', direction: 'forward' | 'backward' | 'neutral', angle }
{ type: 'connected', side, label }
{ type: 'disconnected', side }
```

## Node Data

```ts
{ device: 'any' | 'left' | 'right', axis: 'auto' | 'x' | 'y' | 'z', invert: false, threshold: 20 }
```

## Module Layout

```text
ui/src/objects/joycon/
  joycon-protocol.ts    # report building and parsing (pure)
  leg-motion.ts         # LegMotionTracker (pure)
  JoyconSystem.ts       # WebHID device manager singleton + device store
  joycon-live.ts        # latest per-node reading for the view
  JoyconObject.ts       # headless runtime object
  JoyconNode.svelte     # view: connect, live meter, settings
  constants.ts, prompt.ts, *.test.ts
```

## Limits

- WebHID needs Chrome/Edge desktop. The first connection needs a user click on the node.
- The swing angle is relative tilt, not position. Positional tracking drifts and is out of scope.
