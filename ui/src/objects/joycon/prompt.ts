export const joyconPrompt = `## joycon Object Instructions

General-purpose Nintendo Switch Joy-Con input over WebHID: three-axis angles, accelerometer, gyroscope, joystick, and buttons.

CRITICAL RULES:
1. Requires WebHID (Chrome/Edge desktop). Pair over Bluetooth, then click "Connect Joy-Con" on the node
2. Outlet 0 streams all three angles together at about 60 Hz; outlet 1 emits independent per-axis threshold, button press/release, and connection events
3. Each node exclusively claims one matching controller; any picks an unclaimed controller. Nodes wait when none is available
4. Angles are independent device-axis estimates in degrees relative to calibration, not Euler orientation. Rotation around gravity can drift

Inlet messages:
- bang or {type: 'connect'}: Reconnect Joy-Cons the browser already granted
- {type: 'disconnect'}: Disconnect this node's controller
- {type: 'calibrate'}: Capture the current pose as neutral for all axes
- {type: 'setThreshold', value: number}: Set the shared per-axis threshold in degrees

Outlet 0 (motion):
- {type: 'motion', side: 'left'|'right', accel: [x, y, z] (g), gyro: [x, y, z] (deg/s), angles: [x, y, z] (deg), stick: [x, y] (-1 to 1, right/up positive, 15% radial dead zone), buttons: string[]}

Outlet 1 (events):
- {type: 'move', axis: 'x'|'y'|'z', direction: 'positive'|'negative'|'neutral', angle: number}: Sent when that axis crosses a threshold or returns to neutral. Multiple axes can emit on the same sample
- {type: 'button', button: string, pressed: boolean}: Emitted once per press/release, including stick clicks (lstick/rstick). Disconnect releases held buttons
- {type: 'connected', side, label} / {type: 'disconnected', side}

Stick normalization uses stored user calibration, otherwise factory calibration, with an approximate centered fallback if unavailable. Motion calibration does not change stick calibration.

Button names: left/right/up/down, a/b/x/y, lstick/rstick, l/r/zl/zr/sl/sr, minus/plus/home/capture.

Data:
- device: 'any' | 'left' | 'right'
- threshold: number (degrees, default 20)

There is no axis selector, invert setting, or single angle field in motion messages. Use angles[0], angles[1], angles[2] for X, Y, Z. Build custom gestures from these values or raw accel/gyro.

Example:
\`\`\`json
{
  "type": "joycon",
  "data": { "device": "any", "threshold": 20 }
}
\`\`\`

Handles: inlet "message-in", outlets "message-out-0" (motion) and "message-out-1" (axis events and connection events).`;
