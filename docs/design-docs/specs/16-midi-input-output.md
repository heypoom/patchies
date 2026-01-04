# 16. MIDI input and output

I want to add these nodes that allows us to send and receive MIDI messages:

- `midi.in` - receives MIDI messages from a MIDI device
- `midi.out` - sends MIDI messages to a MIDI device

Let's use the `webmidi` library <https://github.com/djipco/webmidi> to handle this. You will also need to enable SysEx messages (ref: <https://webmidijs.org/docs/getting-started/basics>)

```ts
WebMidi.enable({ sysex: true })
  .then(() => console.log("WebMidi with sysex enabled!"))
  .catch((err) => alert(err));
```

## `midi.in`

Allows you to choose:

- Which MIDI device to receive from
- Which MIDI channel to listen to (1-16, or all channels)
- Which MIDI message types to listen to (note on, note off, control change, etc.)

### Node data

Node data for `midi.in` includes:

- `deviceId: number`: The ID of the MIDI device to receive from
- `channel: number`: The MIDI channel to listen to (1-16, or all channels)
- `events: ('noteOn', 'noteOff', 'controlChange', 'programChange')[]`: The types of MIDI messages to listen to (note on, note off, control change, etc.)

### Messages for `midi.in`

The object listens to these messages:

- `bang` - start listening to MIDI messages using the current configuration.
  - This should call the `MidiSystem` to start setting up the MIDI input.
- `{ type: 'set', deviceId?: number, channel?: number, events?: ('noteOn' | 'noteOff' | 'controlChange' | 'programChange')[] }` - set the configuration for MID input. if any parameter is not provided, it should use the current configuration of the node.

The object emits these messages:

- `{ type: 'noteOn', note: 60, velocity: 127 }` - when a note on message is received
- `{ type: 'noteOff', note: 60, velocity: 0 }` - when a note off message is received
- `{ type: 'controlChange', control: 1, value: 64 }` - when a control change message is received
- `{ type: 'programChange', program: 10 }` - when a program change message is received

## `midi.out`

Allows you to send MIDI messages to a MIDI device.

### Node data for `midi.out`

Node data for `midi.out` includes:

- `deviceId: number`: The ID of the MIDI device to send to
- `channel: number`: The MIDI channel to send on (1-16)
- `event: 'noteOn' | 'noteOff' | 'controlChange' | 'programChange'`: The type of MIDI message to send
- `data: any`: The data to send with the MIDI message (e.g. note number, velocity, control number, value, etc.)

### Messages for `midi.out`

- `bang` - send the MIDI message using the current configuration.
  - This should call the `MidiSystem` to send the MIDI message.
- `{ type: 'send', deviceId?: number, channel?: number, event?: 'noteOn' | 'noteOff' | 'controlChange' | 'programChange', data?: any }` - send a MIDI message with the specified parameters.
  - if any parameter is not provided, it should use the current configuration of the node.
  - for example, if only `data` is provided, it should send a note on message with the specified data on the current device and channel.
- `{ type: 'set', deviceId?: number, channel?: number, event?: 'noteOn' | 'noteOff' | 'controlChange' | 'programChange', data?: any }` - set the configuration for MIDI output for the parameters that are provided.
  - for example, `{type: 'set', deviceId: 1, channel: 1}` should set the device and channel for the MIDI output, but keep the current message type and data.

## Implementation

Let's create a global `MidiSystem` singleton class to handle this. It will manage the global MIDI connection, and route the messages to the appropriate nodes using the `MessageSystem` methods, e.g. `MessageSystem.sendMessage(fromNodeId, data)`.
