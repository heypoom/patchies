export const joyconPrompt = `## joycon Object Instructions

Nintendo Switch Joy-Con motion sensor over WebHID. Typically worn on the thigh (Ring Fit leg strap) to detect leg swings.

CRITICAL RULES:
1. Requires WebHID (Chrome/Edge desktop). The user pairs the Joy-Con over Bluetooth, then clicks "Connect Joy-Con" on the node
2. Outlet 0 emits raw motion at about 60 Hz; outlet 1 emits leg move and connection events
3. Each node exclusively claims one matching controller; any picks an unclaimed controller. Nodes wait when none is available. Use left/right filters for two legs.
4. The swing angle is relative to the pose captured on connect or on {type: 'calibrate'}

Inlet messages:
- bang or {type: 'connect'}: Reconnect Joy-Cons the browser already granted
- {type: 'disconnect'}: Disconnect the Joy-Con
- {type: 'calibrate'}: Capture the current pose as neutral
- {type: 'setThreshold', value: number}: Set the swing threshold in degrees

Outlet 0 (raw):
- {type: 'motion', side: 'left'|'right', accel: [x, y, z] (g), gyro: [x, y, z] (deg/s), angle: number (deg), axis: 'x'|'y'|'z', buttons: string[]}

Outlet 1 (events):
- {type: 'move', direction: 'forward'|'backward'|'neutral', angle: number}: Sent when the leg swing direction changes
- {type: 'connected', side, label} / {type: 'disconnected', side}

Data:
- device: 'any' | 'left' | 'right'
- axis: 'auto' | 'x' | 'y' | 'z' (swing axis; auto picks the axis with the most motion)
- invert: boolean (swap forward and backward)
- threshold: number (degrees, default 20)

Example - Joy-Con leg tracker:
\`\`\`json
{
  "type": "joycon",
  "data": {
    "device": "any",
    "axis": "auto",
    "invert": false,
    "threshold": 20
  }
}
\`\`\`

Handles: inlet "message-in", outlets "message-out-0" (raw) and "message-out-1" (events).`;
