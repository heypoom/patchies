Communicate with hardware devices (Arduino, ESP32, microcontrollers) over WebSerial.

The headless `serial` node sends and receives line-based data without a built-in terminal UI — ideal for data pipelines where you process serial input with downstream nodes.

## Setup

1. Create the node and click the gear icon (or the node body)
2. Click **Request New Port** to open the browser's serial port picker
3. Select your device and configure baud rate

## Shared Ports

Multiple `serial` and `serial.term` nodes can share the same port — connection state is synced across all nodes using that port.

## See Also

- [serial.term](/docs/objects/serial.term) — interactive serial terminal with scrollback
- [mqtt](/docs/objects/mqtt) — MQTT pub/sub messaging
- [midi.in](/docs/objects/midi.in) — MIDI input
