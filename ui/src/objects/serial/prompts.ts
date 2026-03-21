export const serialPrompt = `## serial Object Instructions

WebSerial port for communicating with hardware devices (Arduino, microcontrollers, etc.).

CRITICAL RULES:
1. Requires a browser that supports the WebSerial API (Chrome/Edge)
2. User must grant port access via the browser prompt (triggered by bang or connect message)
3. Received data is line-buffered and emitted one line at a time

Inlet messages:
- bang or {type: 'bang'}: Open port picker and connect
- string: Send a string to the port (line ending appended automatically)
- Uint8Array: Send raw bytes to the port
- number[]: Send raw bytes as a number array (e.g. [0x01, 0x02, 0xff])
- {type: 'connect'}: Open port picker and connect
- {type: 'disconnect'}: Disconnect from the port
- {type: 'setBaud', value: number}: Set the baud rate

Outlet messages:
- {type: 'data', line: string}: A line received from the port
- {type: 'connected', portId: string, label: string}: Port connected
- {type: 'disconnected', portId: string}: Port disconnected
- {type: 'error', message: string}: An error occurred

Example - Basic serial node at 9600 baud:
\`\`\`json
{
  "type": "serial",
  "data": {
    "baudRate": 9600,
    "lineEnding": "\\r\\n",
    "autoConnect": false
  }
}
\`\`\`

Example - Send raw bytes (e.g. DMX-style control):
Connect a js node that outputs \`new Uint8Array([0x00, 255, 0, 128])\` to the serial inlet.

Example - Send a number array:
Connect a js node that outputs \`[0x01, 0x02, 0x03]\` to the serial inlet.

Common patterns:
- Use a js or expr node to parse incoming {type: 'data', line} messages
- Pair with a toggle/button to trigger connect/disconnect
- Use setBaud to change baud rate at runtime before connecting`;

export const serialTermPrompt = `## serial.term Object Instructions

Interactive serial terminal with scrollback buffer and ANSI color support. Combines serial port communication with a visual terminal UI.

CRITICAL RULES:
1. Requires a browser that supports the WebSerial API (Chrome/Edge)
2. User can type commands directly in the terminal input bar
3. Arrow up/down recalls command history
4. Ctrl+C / Ctrl+D / Ctrl+Z send control codes over serial
5. Received lines are displayed in the terminal AND forwarded to the outlet

Inlet messages:
- bang or {type: 'bang'}: Toggle connection (connect or disconnect)
- string: Send a string to the port (shown as tx in terminal, line ending appended)
- Uint8Array: Send raw bytes to the port (shown as hex in terminal, e.g. "01 02 ff")
- number[]: Send raw bytes as a number array (shown as hex in terminal)
- {type: 'connect'}: Toggle connection
- {type: 'disconnect'}: Disconnect from the port
- {type: 'setBaud', value: number}: Set the baud rate

Outlet messages:
- {type: 'data', line: string}: A line received from the port

Example - Terminal at 115200 baud:
\`\`\`json
{
  "type": "serial.term",
  "data": {
    "baudRate": 115200,
    "lineEnding": "\\r\\n",
    "autoConnect": false,
    "maxScrollback": 500
  }
}
\`\`\`

Common patterns:
- Use standalone for interactive debugging of Arduino/ESP32 output
- Connect outlet to a js node to parse and react to incoming lines
- Send programmatic commands via inlet from other nodes while also typing manually`;
