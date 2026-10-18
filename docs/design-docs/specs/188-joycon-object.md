# 188. Joy-Con Object

## Overview

`joycon` is a general-purpose Nintendo Switch Joy-Con input object over WebHID.
It streams all three device-axis angle estimates together as `angles: [x, y, z]`
in degrees, alongside accelerometer, gyroscope, and pressed buttons. Angles are
relative to the calibrated pose; rotation around gravity can drift. These
independent axis estimates are not an Euler-angle representation of orientation.

It gives two outputs:

- Motion data: all three angle estimates, accelerometer, gyroscope, and pressed buttons.
- Per-axis threshold events (`positive`, `negative`, `neutral`) and connection events.

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

## Motion Tracking

`MotionTracker` computes all three device-axis angles on every IMU sample:

1. **Calibrate:** mean accel over the first 30 samples (150 ms) becomes the neutral gravity vector. This runs on connect and on `calibrate`.
2. **Per-axis angle:** a complementary filter combines gyro integration over 5 ms steps with the gravity rotation angle projected on the plane normal to each axis. Accel correction applies only when gravity has a large enough component in that plane.
3. **Gyro sign learning:** each axis learns its gyro sign by correlating gyro rate with changes in the accel angle.
4. **Per-axis events:** each axis independently emits `positive` above `+threshold`, `negative` below `-threshold`, and `neutral` when it returns within the release threshold. The release threshold is `max(threshold - 5°, threshold / 2)`. Events fire only when that axis changes direction. One sample can produce events for all three axes.

The shared threshold defaults to 20°. There is no axis selector or invert setting.
Angles always stream together, regardless of whether any threshold is crossed.
The view shows an X/Y/Z angle meter and calibration status.

This replaces the single `angle`/`axis` motion fields and forward/backward swing
API. No compatibility adapter or saved-data migration is needed; obsolete axis
and invert fields are ignored.

## Joystick and Buttons

The existing 0x30 report carries buttons and both packed 12-bit stick coordinates.
Each node exposes only its controller's stick as `stick: [x, y]` in motion messages.
X is positive to the right and Y positive upward with the controller upright.
Values are normalized to -1…1 using stored user calibration when valid, otherwise
factory calibration. If reading calibration fails or values are invalid, use an
approximate 12-bit centered range and log the fallback. Apply a 15% radial dead
zone and rescale the remaining travel continuously. Motion calibration does not
change joystick calibration.

Read calibration with SPI read subcommand 0x10, matching 0x21 replies by address
and length with a bounded timeout. Left: user 0x8010 (11 bytes, magic B2 A1),
factory 0x603D (9 bytes). Right: user 0x801B, factory 0x6046. Calibration is
read-only and per physical connection.

Outlet 1 emits `{ type: 'button', button, pressed: boolean }` only when a button
changes. A held button on the first report emits a press; holding does not repeat.
Disconnecting or switching controllers emits releases for held buttons before
the disconnected event, preventing stuck downstream state. Each runtime tracks
its own buttons. Buttons and sticks work during motion calibration.

Buttons include D-pad (`left`, `right`, `up`, `down`), face buttons (`a`, `b`, `x`,
`y`), stick clicks (`lstick`, `rstick`), shoulders (`l`, `r`, `zl`, `zr`, `sl`, `sr`),
and system buttons (`minus`, `plus`, `home`, `capture`). Parse only the connected
side's button byte, plus the shared byte.

## Messages

Inlet:

| Message                         | Effect                                                 |
| ------------------------------- | ------------------------------------------------------ |
| `bang`, `{type: 'connect'}`     | Reconnect to Joy-Cons that the browser already granted |
| `{type: 'disconnect'}`          | Close the matching Joy-Con                             |
| `{type: 'calibrate'}`           | Capture the current pose as neutral                    |
| `{type: 'setThreshold', value}` | Set the per-axis motion threshold in degrees           |

Outlet 0 (raw, ~60 Hz):

```ts
{ type: 'motion', side, accel: [x, y, z], gyro: [x, y, z], angles: [x, y, z], stick: [x, y], buttons: string[] }
```

Outlet 1 (events):

```ts
{ type: 'move', axis: 'x' | 'y' | 'z', direction: 'positive' | 'negative' | 'neutral', angle }
{ type: 'button', button: string, pressed: boolean }
{ type: 'connected', side, label }
{ type: 'disconnected', side }
```

## Node Data

```ts
{ device: 'any' | 'left' | 'right', threshold: 20 }
```

## Module Layout

```text
ui/src/objects/joycon/
  joycon-protocol.ts    # report building and parsing (pure)
  motion.ts             # MotionTracker (pure)
  JoyconSystem.ts       # WebHID device manager singleton + device store
  joycon-live.ts        # latest per-node reading for the view
  JoyconObject.ts       # headless runtime object
  JoyconNode.svelte     # view: connect, live meter, settings
  constants.ts, prompt.ts, *.test.ts
```

## Limits

- WebHID needs Chrome/Edge desktop. The first connection needs a user click on the node.
- The angle estimates measure relative rotation, not position. Positional tracking drifts and is out of scope.

## Protocol References

- [Standard input report](https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering/blob/master/bluetooth_hid_notes.md#standard-input-report-format)
- [SPI read subcommand](https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering/blob/master/bluetooth_hid_subcommands_notes.md#subcommand-0x10-spi-flash-read)
- [Stick calibration layouts](https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering/blob/master/spi_flash_notes.md#analog-stick-factory-and-user-calibration)
