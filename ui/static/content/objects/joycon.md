Read motion from a Nintendo Switch Joy-Con and detect leg swings.

Strap a Joy-Con to your thigh, for example with the Ring Fit Adventure leg strap. The node then tells you when your leg swings forward or backward. It also streams the raw accelerometer, gyroscope, and button data, so you can build your own gestures.

## Setup

1. Pair the Joy-Con with your computer over Bluetooth. Hold the small sync button until the lights scan.
2. Click **Connect Joy-Con** on the node and pick the Joy-Con in the browser prompt.
3. Stand still for a moment. The node uses your pose at connect time as neutral.

After a reload, send `bang` or `connect` to reconnect without the prompt.

> **Important**: Joy-Con access uses WebHID, which works in Chrome and Edge on desktop.

## Multiple Joy-Cons

Each `joycon` node uses a separate controller. **Any Joy-Con** picks an available controller; use **Left Joy-Con** or **Right Joy-Con** in settings to choose a side. If all matching controllers are in use, the node waits for one to become available. Deleting a node frees its controller for another node. Calibration and motion settings apply independently to each node.

## Leg Movement

Outlet 1 sends a `move` event each time the leg swing changes direction:

```js
{ type: 'move', direction: 'forward', angle: 32.5 }
```

The node sends `forward` when the swing angle passes the threshold (20° by default) and `backward` when it passes the negative threshold. It sends `neutral` when the leg comes back.

If forward and backward are swapped, turn on **Invert** in the settings. This depends on which leg wears the strap and how the Joy-Con sits in it.

Send `calibrate`, or click **zero**, to use your current pose as neutral.

> **Tip**: **Swing axis** is on **Auto** by default. It picks the axis that moves the most, so the Joy-Con can sit in the strap in any direction. Pin an axis if side steps confuse it.

## Raw Data

Outlet 0 sends one message per Joy-Con report, about 60 per second:

```js
{
  type: 'motion',
  side: 'left',
  accel: [0.01, 0.98, -0.05], // g
  gyro: [1.2, -0.4, 0.3],     // degrees per second
  angle: 4.1,                 // swing angle in degrees
  axis: 'x',
  buttons: ['zl']
}
```

The swing angle measures tilt, not position. It can't tell you where your foot is in space.

## See Also

- [serial](/docs/objects/serial) - talk to Arduino and other serial devices
- [vision.body](/docs/objects/vision.body) - track body pose from a camera
