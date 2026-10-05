Use a Nintendo Switch Joy-Con as a motion and button controller.

Stream X, Y, and Z angle estimates together with accelerometer, gyroscope, joystick, and button data. Use them to control visuals, sound, or your own gestures. Each axis can also emit an event when its angle crosses a threshold.

## Setup

1. Pair the Joy-Con with your computer over Bluetooth. Hold the small sync button until the lights scan.
2. Click **Connect Joy-Con** on the node and pick the Joy-Con in the browser prompt.
3. Stand still for a moment. The node uses your pose at connect time as neutral.

After a reload, send `bang` or `connect` to reconnect without the prompt.

> **Important**: Joy-Con access uses WebHID, which works in Chrome and Edge on desktop.

## Multiple Joy-Cons

Each `joycon` node uses a separate controller. **Any Joy-Con** picks an available controller; use **Left Joy-Con** or **Right Joy-Con** in settings to choose a side. If all matching controllers are in use, the node waits for one to become available. Deleting a node frees its controller for another node. Calibration and motion settings apply independently to each node.

## Angles and Motion Events

Outlet 0 sends `angles: [x, y, z]` in degrees relative to the calibrated pose. The node shows all three angles. Send `calibrate`, or click **zero**, to use the current pose as neutral.

Outlet 1 sends independent `move` events for each axis:

```js
{ type: 'move', axis: 'x', direction: 'positive', angle: 32.5 }
```

Each axis sends `positive` above the threshold (20° by default), `negative` below the negative threshold, and `neutral` when it returns inside the release threshold. The release threshold is 5° below the trigger threshold, or half the trigger threshold if that is larger. Events fire only when the state changes. All three axes can emit events on the same sample.

Change **Threshold** in settings, or send `{ type: 'setThreshold', value: 30 }`. The threshold applies to all three axes and affects events only; angles stream continuously.

## Motion Data

Outlet 0 sends one message per Joy-Con report, about 60 per second:

```js
{
  type: 'motion',
  side: 'left',
  accel: [0.01, 0.98, -0.05], // g
  gyro: [1.2, -0.4, 0.3],     // degrees per second
  angles: [4.1, -2.3, 8.0],  // degrees around device X, Y, Z
  stick: [0.5, -0.2],        // normalized X/Y, right/up positive
  buttons: ['zl']
}
```

Angles are independent estimates around the device axes, not a full Euler-angle orientation. Rotation around gravity can drift. The object measures motion, not position.

## Joystick and Buttons

The same connection reads the joystick and buttons while streaming motion.
`stick: [x, y]` ranges from -1 to 1: X increases to the right and Y upward with the controller upright. A 15% radial dead zone makes a resting stick read `[0, 0]`; the remaining travel is rescaled continuously.

The object reads stored user calibration, then factory calibration. If neither is available, it logs a warning and uses an approximate centered range. Clicking **zero** calibrates motion only.

The `buttons` array lists all currently held buttons. Outlet 1 also sends an event once for each press and release:

```js
{ type: 'button', button: 'up', pressed: true }
{ type: 'button', button: 'up', pressed: false }
```

| Controls | Button names |
| -------- | ------------ |
| Direction buttons | `left`, `right`, `up`, `down` |
| Face buttons | `a`, `b`, `x`, `y` |
| Joystick click | `lstick`, `rstick` |
| Shoulders and rail buttons | `l`, `r`, `zl`, `zr`, `sl`, `sr` |
| System buttons | `minus`, `plus`, `home`, `capture` |

Holding a button does not repeat press events. Disconnecting or switching controllers releases held buttons before sending `disconnected`.

## See Also

- [serial](/docs/objects/serial) - talk to Arduino and other serial devices
- [vision.body](/docs/objects/vision.body) - track body pose from a camera
