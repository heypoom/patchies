import { debounce } from "lodash"
import { MidiInputEvent } from "machine-wasm"
import {
  ControlChangeMessageEvent,
  Input,
  InputEventMap,
  NoteMessageEvent,
  Output,
  WebMidi,
} from "webmidi"

import { $midi } from "@/store/midi"
import { FirstArg, UnionToIntersection } from "@/types/helper"

import { launchpad, launchpadNames } from "./launchpad"

// Maps the event names from WebAssembly to the event names in the MIDI spec.
const nameMap = {
  NoteOn: "noteon",
  NoteOff: "noteoff",
  ControlChange: "controlchange",
} satisfies Record<MidiInputEvent, keyof InputEventMap>

type NameMap = typeof nameMap

// Get the possible MIDI events that our canvas can listen to.
export type MidiEvent = FirstArg<InputEventMap[NameMap[keyof NameMap]]>

interface MidiListener<E extends MidiInputEvent = MidiInputEvent> {
  type: E
  channels: number[]
  port: number
  handle: UnionToIntersection<InputEventMap[NameMap[E]]>
}

export const isControlChangeEvent = (
  e: MidiEvent,
): e is ControlChangeMessageEvent => "controller" in e

export const isNoteEvent = (e: MidiEvent): e is NoteMessageEvent => "note" in e

export class MidiManager {
  initialized = false

  /** Mapping of MIDI event listeners */
  midiListeners: Map<number, MidiListener> = new Map()

  inputs: Input[] = []
  outputs: Output[] = []

  /** Debounce time settings. Set to zero to disable debouncing. */
  debounceSettings: Record<MidiInputEvent, number> = {
    NoteOn: 0,
    NoteOff: 0,
    ControlChange: 5,
  }

  async setup() {
    if (this.initialized) return

    await WebMidi.enable({ sysex: true })
    this.scanPorts()

    WebMidi.addListener("portschanged", () => {
      // Re-scan the ports if they change.
      this.scanPorts()
    })

    WebMidi.addListener("disconnected", (e) => {
      // Teardown the launchpad if it's disconnected.
      if (e.port.name === launchpadNames.midiOut) launchpad.teardown()
    })

    this.initialized = true
  }

  scanPorts() {
    this.inputs = WebMidi.inputs
    this.outputs = WebMidi.outputs

    // If the launchpad is connected, we configure it.
    launchpad.setup(this.outputs)

    $midi.set({
      ready: true,
      inputs: this.inputs.map((input) => input.name),
      outputs: this.outputs.map((output) => output.name),
    })
  }

  async on<L extends MidiListener>(id: number, listener: L) {
    if (!this.initialized) await this.setup()
    if (this.midiListeners.has(id)) this.off(id)

    const { port, channels } = listener
    const input = this.inputs[port]

    if (!input) return

    const type = nameMap[listener.type]

    const debounceMs = this.debounceSettings[listener.type]
    const shouldDebounce = debounceMs > 0

    // Debounce handle to prevent spamming if the debounced time is greater than 0.
    const handle = shouldDebounce
      ? debounce(listener.handle, debounceMs, {
          leading: true,
          trailing: true,
        })
      : listener.handle

    input.addListener(type, handle, {
      // If channels filter are empty, we accept all channels.
      ...(channels?.length > 0 && { channels }),
    })

    this.midiListeners.set(id, { ...listener, handle })
  }

  off(id: number) {
    if (!this.midiListeners.has(id)) return

    const listener = this.midiListeners.get(id)
    if (!listener) return

    const { handle, port, channels } = listener
    const input = this.inputs[port]
    if (!input) return

    const type = nameMap[listener.type]

    input.removeListener(type, handle, {
      // Only remove by channel if the channel filter is defined.
      ...(channels?.length > 0 && { channels }),
    })

    this.midiListeners.delete(id)
  }
}

export const midiManager = new MidiManager()
