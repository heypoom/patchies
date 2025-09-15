import { Effect } from "machine-wasm"
import { map } from "nanostores"

import { MidiState } from "@/types/midi"

const defaultMidiState: MidiState = {
  ready: false,
  inputs: [],
  outputs: [],
}

export const $midi = map(defaultMidiState)
export const $lastMidiEvent = map<Record<number, Effect.Midi | null>>({})
