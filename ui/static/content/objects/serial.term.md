Interactive serial terminal with scrollback, ANSI color support, and a command input bar.

Use `serial.term` when you want to see raw serial output and type commands directly — like a built-in serial monitor.

## Setup

1. Create the node and click the USB icon in the header (or use the settings gear)
2. Select your device from the browser's serial port picker
3. Start sending and receiving data

## Features

- **Scrollback** — configurable buffer (default 500 lines)
- **ANSI colors** — parses standard ANSI escape codes for colored output
- **Line-based I/O** — configurable line endings (CR+LF, LF, CR, or none)
- **Resizable** — drag the node edges to resize the terminal

## See Also

- [serial](/docs/objects/serial) — headless serial node for data pipelines
- [mqtt](/docs/objects/mqtt) — MQTT pub/sub messaging
