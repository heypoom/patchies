# 97. Serial Object

## Overview

A WebSerial integration for Patchies, enabling bidirectional communication with serial devices (Arduino, ESP32, microcontrollers, etc.). Two node types share a centralized `SerialSystem` manager and reactive store, allowing multiple nodes to access the same serial port simultaneously.

**Node types:**

- **`serial`** — headless serial controller (compact, like `midi.in` / `midi.out`). Connect/disconnect, configure baud rate, send/receive messages through the Patchies message system.
- **`serial.terminal`** — full serial terminal with ANSI color parsing, scrollback buffer, and inline command input. Same port-sharing capability.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SerialSystem                       │
│  (singleton manager — owns all WebSerial ports)      │
│                                                      │
│  ports: Map<portId, { port, readers[], writers[] }>  │
│  subscribers: Map<portId, Set<nodeId>>               │
│                                                      │
│  requestPort() → prompt user, open, assign portId    │
│  subscribe(portId, nodeId, callback)                 │
│  unsubscribe(portId, nodeId)                         │
│  write(portId, data)                                 │
│  closePort(portId)                                   │
└──────────────────────┬──────────────────────────────┘
                       │ updates
                       ▼
┌─────────────────────────────────────────────────────┐
│               serial.store.ts                        │
│  (reactive Svelte stores)                            │
│                                                      │
│  serialPorts: writable<SerialPortInfo[]>             │
│  serialConnections: writable<Map<portId, status>>    │
└──────────────────────┬──────────────────────────────┘
                       │ read by
              ┌────────┴────────┐
              ▼                 ▼
     ┌──────────────┐  ┌────────────────────┐
     │   serial      │  │  serial.terminal    │
     │  (headless)   │  │  (terminal UI)      │
     └──────────────┘  └────────────────────┘
```

## SerialSystem (Singleton Manager)

Located at `ui/src/lib/canvas/SerialSystem.ts`. Follows the `MIDISystem` pattern.

### Port Sharing Model

WebSerial allows only one `ReadableStream` reader at a time. To share a port across multiple nodes:

- `SerialSystem` owns the port's reader loop
- Incoming data is broadcast to all subscribers for that port
- Writing is serialized through a shared writer with lock/release per write

### Interface

```typescript
interface SerialPortEntry {
  port: SerialPort;
  portId: string;
  baudRate: number;
  connected: boolean;
  label: string;            // user-assigned or auto-generated
  lineBuffer: string;       // accumulates partial lines
  subscribers: Map<string, SerialSubscriber>;  // nodeId → callback
}

interface SerialSubscriber {
  nodeId: string;
  onLine: (line: string) => void;     // called per complete line
  onRawData?: (chunk: string) => void; // called per raw chunk (for terminal)
}

interface SerialPortInfo {
  portId: string;
  label: string;
  baudRate: number;
  connected: boolean;
  subscriberCount: number;
}
```

### Key Methods

```typescript
class SerialSystem {
  private static instance: SerialSystem;
  private ports: Map<string, SerialPortEntry> = new Map();

  static getInstance(): SerialSystem;

  // Prompt user to select a serial port, open it, return portId
  async requestPort(options?: { baudRate?: number }): Promise<string>;

  // Connect to an already-known port (e.g. on reload)
  async connectPort(portId: string, baudRate?: number): Promise<void>;

  // Subscribe a node to receive data from a port
  subscribe(portId: string, subscriber: SerialSubscriber): void;

  // Unsubscribe a node
  unsubscribe(portId: string, nodeId: string): void;

  // Write string data to a port (appends \r\n)
  async write(portId: string, data: string): Promise<void>;

  // Write raw bytes
  async writeRaw(portId: string, data: Uint8Array): Promise<void>;

  // Disconnect and close a port
  async closePort(portId: string): Promise<void>;

  // Get all port info (for store sync)
  getPortInfoList(): SerialPortInfo[];

  // Clean up everything
  cleanup(): void;
}
```

### Read Loop

When a port is opened, `SerialSystem` starts a read loop:

```typescript
private async startReadLoop(entry: SerialPortEntry): Promise<void> {
  const textDecoder = new TextDecoderStream();
  entry.port.readable.pipeTo(textDecoder.writable);
  const reader = textDecoder.readable.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    // Broadcast raw chunks to subscribers that want them (terminal)
    for (const sub of entry.subscribers.values()) {
      sub.onRawData?.(value);
    }

    // Line buffering: split on \r\n, broadcast complete lines
    entry.lineBuffer += value;
    const lines = entry.lineBuffer.split(/\r?\n/);
    entry.lineBuffer = lines.pop() ?? '';

    for (const line of lines) {
      for (const sub of entry.subscribers.values()) {
        sub.onLine(line);
      }
    }
  }
}
```

## Reactive Store

Located at `ui/src/stores/serial.store.ts`.

```typescript
import { writable } from 'svelte/store';

export interface SerialDeviceInfo {
  portId: string;
  label: string;
  baudRate: number;
  connected: boolean;
  subscriberCount: number;
}

export const serialPorts = writable<SerialDeviceInfo[]>([]);

export function updateSerialPorts(ports: SerialDeviceInfo[]): void {
  serialPorts.set(ports);
}
```

`SerialSystem` calls `updateSerialPorts()` whenever ports change (connect, disconnect, subscribe, unsubscribe).

## Node: `serial` (Headless Controller)

Compact node similar to `midi.in` / `midi.out`. UI shows:

- Port name (truncated) or "Select port" prompt
- Connection status indicator (green dot = connected)
- Settings panel (slide-out, like MIDI nodes) with:
  - Port selector dropdown (lists ports from `serial.store`)
  - Baud rate selector (common rates: 9600, 19200, 38400, 57600, 115200)
  - Line ending selector (CR+LF, LF, CR, None)
  - "Request New Port" button (triggers `navigator.serial.requestPort()`)

### Handles

- **1 message inlet**: receives commands and data to send
- **1 message outlet**: emits received lines as messages

### Inlet Messages

| Message | Description |
|---------|-------------|
| `bang` | Request port (if disconnected) or flush |
| `connect` | Connect to configured port |
| `disconnect` | Disconnect from port |
| `send <data>` | Send string data to serial port |
| `baud <rate>` | Set baud rate |
| `set portId <id>` | Select a specific port |

### Outlet Messages

Received serial lines are sent as messages:

```typescript
// Each complete line from serial:
{ type: 'data', line: 'Hello from Arduino' }

// Connection state changes:
{ type: 'connected', portId: '...', label: '...' }
{ type: 'disconnected', portId: '...' }

// Errors:
{ type: 'error', message: '...' }
```

### Default Node Data

```typescript
{
  portId: '',
  baudRate: 9600,
  lineEnding: '\r\n',
  autoConnect: false
}
```

## Node: `serial.terminal` (Terminal UI)

Larger resizable node with embedded terminal. UI inspired by the Vue reference implementation but built in Svelte.

### Layout

```
┌──────────────────────────────────────────────────┐
│ ● SERIAL CONSOLE          9600 BAUD  [Clear] [⚡]│
│   ACTIVE SESSION                                  │
├──────────────────────────────────────────────────┤
│                                                   │
│  12:34:56  Hello from Arduino                     │
│  12:34:56  ▸ LED ON                               │
│  12:34:57  Sensor: 42.5°C                         │
│  12:34:57  ! Connection timeout                   │
│                                                   │
├──────────────────────────────────────────────────┤
│ $ Enter command...                        [ENTER] │
└──────────────────────────────────────────────────┘
```

### Features

- **ANSI color parsing**: Supports SGR codes (colors 30-37, 90-97, bold, underline, reset)
- **Scrollback**: 500-line circular buffer (configurable)
- **Line types**: `rx` (received), `tx` (sent), `error`, `system` — styled differently
- **Timestamps**: Hover-revealed HH:MM:SS timestamps per line
- **Auto-scroll**: Follows new output, pauses when user scrolls up
- **Inline input**: Command bar at bottom with `$` prompt, sends on Enter

### Handles

- **1 message inlet**: Same commands as `serial` node, plus data forwarded to port
- **1 message outlet**: Same output format as `serial` node

### Default Node Data

```typescript
{
  portId: '',
  baudRate: 9600,
  lineEnding: '\r\n',
  autoConnect: false,
  maxScrollback: 500,
  showTimestamps: true
}
```

## ANSI Parser

Shared utility at `ui/src/objects/serial/ansi.ts`.

```typescript
interface AnsiSpan {
  text: string;
  style: {
    color?: string;
    fontWeight?: string;
    textDecoration?: string;
  };
}

export function parseAnsi(text: string): AnsiSpan[];
```

Supports:
- Reset (0), Bold (1), Underline (4)
- Standard colors (30-37), bright colors (90-97)
- Zinc-palette color map matching Patchies dark theme

## Message Schemas

Located at `ui/src/objects/serial/schema.ts`. Uses TypeBox + `msg()` helper.

```typescript
import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

// Inlet commands
export const SerialConnect = sym('connect');
export const SerialDisconnect = sym('disconnect');
export const SerialSend = msg('send', { data: Type.String() });
export const SerialBaud = msg('baud', { rate: Type.Number() });

// Outlet messages
export const SerialData = msg('data', { line: Type.String() });
export const SerialConnected = msg('connected', {
  portId: Type.String(),
  label: Type.String()
});
export const SerialDisconnected = msg('disconnected', {
  portId: Type.String()
});
export const SerialError = msg('error', { message: Type.String() });

export const serialMessages = {
  connect: schema(SerialConnect),
  disconnect: schema(SerialDisconnect),
  send: schema(SerialSend),
  baud: schema(SerialBaud),
  data: schema(SerialData),
  connected: schema(SerialConnected),
  disconnected: schema(SerialDisconnected),
  error: schema(SerialError)
};
```

## Module File Structure

```
ui/src/objects/serial/
├── SerialNode.svelte           # Headless controller UI
├── SerialTerminalNode.svelte   # Terminal UI
├── SerialSettings.svelte       # Shared settings panel (port, baud, line ending)
├── SerialTerminal.svelte       # Terminal display component (scrollback, ANSI)
├── schema.ts                   # TypeBox message schemas
├── constants.ts                # Types, defaults, baud rates
├── ansi.ts                     # ANSI escape code parser
└── prompt.ts                   # AI object prompt

ui/src/lib/canvas/SerialSystem.ts    # Singleton manager
ui/src/stores/serial.store.ts        # Reactive store
```

## Integration Checklist

1. **Node types** (`src/lib/nodes/node-types.ts`):
   - `'serial': SerialNode`
   - `'serial.terminal': SerialTerminalNode`

2. **Default data** (`src/lib/nodes/defaultNodeData.ts`):
   - `.with('serial', () => DEFAULT_SERIAL_DATA)`
   - `.with('serial.terminal', () => DEFAULT_SERIAL_TERMINAL_DATA)`

3. **Object packs** (`src/lib/extensions/object-packs.ts`):
   - Add to `networking` pack or create new `serial` pack:
     ```typescript
     { id: 'serial', name: 'Serial', description: 'WebSerial device communication', icon: 'Usb', objects: ['serial', 'serial.terminal'] }
     ```

4. **Pack icons** (`src/lib/extensions/pack-icons.ts`):
   - Import `Usb` from lucide, add to match

5. **AI descriptions** (`src/lib/ai/object-descriptions-types.ts`):
   ```
   ## Serial
   - serial: WebSerial port controller (connect, send, receive)
   - serial.terminal: Serial terminal with ANSI color display
   ```

6. **AI prompt** (`src/lib/ai/object-prompts/index.ts`):
   - Register `serial` and `serial.terminal` prompts

7. **Object docs** (`static/content/objects/serial.md`, `serial.terminal.md`)

8. **Undo/redo**: `useNodeDataTracker` for port, baud rate, line ending changes

## Browser Compatibility

WebSerial API requires:
- Chrome/Edge 89+ (desktop only)
- User gesture for `requestPort()`
- HTTPS or localhost

`SerialSystem.isSupported()` should check `'serial' in navigator` and surface a clear error in the UI when unsupported.

## Related Specs

- `28-expr-object.md` — text object pattern
- `68-undo-redo-system.md` — undo/redo tracking for node data
- `96-pads-drum-sampler.md` — self-contained object module pattern
